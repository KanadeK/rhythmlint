import { createHash } from "node:crypto";

import { calendarDateBounds } from "./ics.js";
import {
  intersection,
  isoMinute,
  mergeIntervals,
  minutesBetween,
  overlaps,
  startOfWeekKey,
  subtractIntervals,
  weekdayForDateKey,
  zonedDateTimeToUtc,
} from "./time.js";
import type {
  AuditMetrics,
  AuditReport,
  AuditWindow,
  CalendarEvent,
  DayMetrics,
  Finding,
  FindingEvidence,
  Interval,
  ParseResult,
  RhythmLintConfig,
  Severity,
  WeekMetrics,
} from "./types.js";

const VERSION = "0.1.0";

interface DayContext {
  date: string;
  work: Interval;
  events: CalendarEvent[];
  active: CalendarEvent[];
  meetings: CalendarEvent[];
  focus: CalendarEvent[];
  freeForFocus: Interval[];
  lunchFree: Interval[];
  metrics: DayMetrics;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function activeEvent(event: CalendarEvent): boolean {
  return (
    !event.allDay &&
    !event.transparent &&
    !event.cancelled &&
    event.kind !== "ignored"
  );
}

function eventInterval(event: CalendarEvent): Interval {
  return {
    start: event.start,
    end: event.end,
    eventIds: [event.id],
    kind: event.kind,
  };
}

function sumMinutes(intervals: Interval[]): number {
  return intervals.reduce(
    (total, interval) => total + minutesBetween(interval.start, interval.end),
    0,
  );
}

function eventLabel(event: CalendarEvent, config: RhythmLintConfig): string {
  return config.privacy.redactTitles
    ? `Event ${event.id.slice(0, 6)}`
    : event.summary;
}

function sanitizeEvent(
  event: CalendarEvent,
  config: RhythmLintConfig,
): CalendarEvent {
  return {
    ...event,
    summary: config.privacy.redactTitles
      ? `Event ${event.id.slice(0, 6)}`
      : event.summary,
    location:
      config.privacy.redactLocations && event.location
        ? "(redacted location)"
        : event.location,
  };
}

function workInterval(date: string, config: RhythmLintConfig): Interval {
  return {
    start: zonedDateTimeToUtc(date, config.workweek.start, config.timezone),
    end: zonedDateTimeToUtc(date, config.workweek.end, config.timezone),
  };
}

function clips(
  event: CalendarEvent,
  container: Interval,
): Interval | undefined {
  return intersection(eventInterval(event), container);
}

function buildDayContext(
  date: string,
  events: CalendarEvent[],
  config: RhythmLintConfig,
): DayContext {
  const work = workInterval(date, config);
  const dayEvents = events.filter(
    (event) => event.end > work.start && event.start < work.end,
  );
  const active = dayEvents
    .filter(activeEvent)
    .sort(
      (a, b) =>
        a.start.getTime() - b.start.getTime() || a.id.localeCompare(b.id),
    );
  const meetings = active.filter((event) => event.kind === "meeting");
  const focus = active.filter((event) => event.kind === "focus");
  const busyIntervals = active
    .map((event) => clips(event, work))
    .filter((item): item is Interval => item !== undefined);
  const nonFocusIntervals = active
    .filter((event) => event.kind !== "focus")
    .map((event) => clips(event, work))
    .filter((item): item is Interval => item !== undefined);
  const meetingIntervals = meetings
    .map((event) => clips(event, work))
    .filter((item): item is Interval => item !== undefined);
  const focusIntervals = focus
    .map((event) => clips(event, work))
    .filter((item): item is Interval => item !== undefined);
  const freeForFocus = subtractIntervals(work, nonFocusIntervals);
  const protectedFocus = focusIntervals.flatMap((interval) =>
    subtractIntervals(interval, nonFocusIntervals),
  );
  const qualifying = freeForFocus.filter(
    (interval) =>
      minutesBetween(interval.start, interval.end) >=
      config.policy.minimumFocusBlockMinutes,
  );
  const protectedQualifying = protectedFocus.filter(
    (interval) =>
      minutesBetween(interval.start, interval.end) >=
      config.policy.minimumFocusBlockMinutes,
  );
  const fragments = freeForFocus.filter(
    (interval) =>
      minutesBetween(interval.start, interval.end) <
      config.policy.minimumFocusBlockMinutes,
  );
  const lunch: Interval = {
    start: zonedDateTimeToUtc(
      date,
      config.workweek.lunch.earliest,
      config.timezone,
    ),
    end: zonedDateTimeToUtc(
      date,
      config.workweek.lunch.latest,
      config.timezone,
    ),
  };
  const lunchFree = subtractIntervals(lunch, busyIntervals);
  const longest = Math.max(
    0,
    ...freeForFocus.map((item) => minutesBetween(item.start, item.end)),
  );
  const metrics: DayMetrics = {
    date,
    workMinutes: minutesBetween(work.start, work.end),
    busyMinutes: sumMinutes(mergeIntervals(busyIntervals)),
    meetingMinutes: sumMinutes(mergeIntervals(meetingIntervals)),
    protectedFocusMinutes: sumMinutes(mergeIntervals(protectedFocus)),
    availableFocusMinutes: sumMinutes(qualifying),
    qualifyingFocusBlocks: qualifying.length,
    protectedFocusBlocks: protectedQualifying.length,
    fragmentMinutes: sumMinutes(fragments),
    longestFocusBlockMinutes: longest,
    contextSwitches: Math.max(0, active.length - 1),
  };
  return {
    date,
    work,
    events: dayEvents,
    active,
    meetings,
    focus,
    freeForFocus,
    lunchFree,
    metrics,
  };
}

function weekMetrics(days: DayContext[]): WeekMetrics[] {
  const weeks = new Map<string, WeekMetrics>();
  for (const day of days) {
    const weekStart = startOfWeekKey(day.date);
    const week = weeks.get(weekStart) ?? {
      weekStart,
      workdays: 0,
      meetingMinutes: 0,
      qualifyingFocusBlocks: 0,
      protectedFocusBlocks: 0,
      availableFocusMinutes: 0,
    };
    week.workdays += 1;
    week.meetingMinutes += day.metrics.meetingMinutes;
    week.qualifyingFocusBlocks += day.metrics.qualifyingFocusBlocks;
    week.protectedFocusBlocks += day.metrics.protectedFocusBlocks;
    week.availableFocusMinutes += day.metrics.availableFocusMinutes;
    weeks.set(weekStart, week);
  }
  return [...weeks.values()].sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart),
  );
}

function finding(
  ruleId: string,
  severity: Severity,
  title: string,
  message: string,
  repair: string,
  events: CalendarEvent[],
  evidence: FindingEvidence,
): Finding {
  const eventIds = events.map((event) => event.id).sort();
  const evidenceIdentity = JSON.stringify(
    Object.fromEntries(
      Object.entries(evidence).filter(([key]) => key !== "eventLabels"),
    ),
  );
  return {
    fingerprint: hash(
      `${ruleId}\0${eventIds.join(",")}\0${evidenceIdentity}`,
    ).slice(0, 16),
    ruleId,
    severity,
    title,
    message,
    repair,
    eventIds,
    evidence,
  };
}

function eventEvidence(
  events: CalendarEvent[],
  config: RhythmLintConfig,
): string[] {
  return events.map((event) => eventLabel(event, config));
}

function overlapFindings(
  days: DayContext[],
  config: RhythmLintConfig,
): Finding[] {
  if (config.policy.overlap === "off") return [];
  const found = new Map<string, Finding>();
  for (const day of days) {
    for (let leftIndex = 0; leftIndex < day.active.length; leftIndex += 1) {
      const left = day.active[leftIndex];
      if (!left) continue;
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < day.active.length;
        rightIndex += 1
      ) {
        const right = day.active[rightIndex];
        if (!right || right.start >= left.end) break;
        if (!overlaps(eventInterval(left), eventInterval(right))) continue;
        const overlap = intersection(eventInterval(left), eventInterval(right));
        if (!overlap) continue;
        const events = [left, right];
        const item = finding(
          "RL001",
          config.policy.overlap,
          "Active events overlap",
          `${eventLabel(left, config)} and ${eventLabel(right, config)} overlap for ${minutesBetween(overlap.start, overlap.end)} minutes.`,
          "Move, shorten, decline, or mark one event transparent; do not hide the conflict by changing the lint threshold.",
          events,
          {
            date: day.date,
            minutes: minutesBetween(overlap.start, overlap.end),
            window: `${isoMinute(overlap.start)} / ${isoMinute(overlap.end)}`,
            eventLabels: eventEvidence(events, config),
          },
        );
        found.set(item.fingerprint, item);
      }
    }
  }
  return [...found.values()];
}

function transitionFindings(
  days: DayContext[],
  config: RhythmLintConfig,
): Finding[] {
  const minimum = config.policy.minimumTransitionMinutes;
  if (minimum === 0) return [];
  const results: Finding[] = [];
  for (const day of days) {
    for (let index = 1; index < day.active.length; index += 1) {
      const previous = day.active[index - 1];
      const current = day.active[index];
      if (!previous || !current || current.start < previous.end) continue;
      const gap = minutesBetween(previous.end, current.start);
      if (gap >= minimum) continue;
      const events = [previous, current];
      results.push(
        finding(
          "RL002",
          "warning",
          "Transition buffer is too short",
          `${eventLabel(previous, config)} leaves ${gap} minutes before ${eventLabel(current, config)}; policy requires ${minimum}.`,
          `Move or shorten one event to create at least ${minimum} minutes for transition, preparation, or travel.`,
          events,
          {
            date: day.date,
            gapMinutes: gap,
            limitMinutes: minimum,
            eventLabels: eventEvidence(events, config),
          },
        ),
      );
    }
  }
  return results;
}

function dailyBudgetFindings(
  days: DayContext[],
  config: RhythmLintConfig,
): Finding[] {
  const limit = config.policy.dailyMeetingBudgetMinutes;
  return days
    .filter((day) => day.metrics.meetingMinutes > limit)
    .map((day) =>
      finding(
        "RL003",
        "warning",
        "Daily meeting budget exceeded",
        `${day.metrics.meetingMinutes} meeting minutes exceed the ${limit}-minute daily budget on ${day.date}.`,
        "Decline low-value meetings, shorten agendas, or batch movable meetings into a collaboration window.",
        day.meetings,
        {
          date: day.date,
          minutes: day.metrics.meetingMinutes,
          limitMinutes: limit,
          eventLabels: eventEvidence(day.meetings, config),
        },
      ),
    );
}

function weeklyBudgetFindings(
  weeks: WeekMetrics[],
  config: RhythmLintConfig,
): Finding[] {
  const normalDays = config.workweek.days.length;
  return weeks.flatMap((week) => {
    const scaledLimit = Math.round(
      (config.policy.weeklyMeetingBudgetMinutes * week.workdays) / normalDays,
    );
    if (week.meetingMinutes <= scaledLimit) return [];
    return [
      finding(
        "RL004",
        "warning",
        "Weekly meeting budget exceeded",
        `${week.meetingMinutes} meeting minutes exceed the ${scaledLimit}-minute budget for the ${week.workdays}-day audited portion of week ${week.weekStart}.`,
        "Remove recurring meetings without decisions, shorten default durations, and cluster remaining meetings.",
        [],
        {
          date: week.weekStart,
          minutes: week.meetingMinutes,
          limitMinutes: scaledLimit,
        },
      ),
    ];
  });
}

function consecutiveMeetingFindings(
  days: DayContext[],
  config: RhythmLintConfig,
): Finding[] {
  const maximum = config.policy.maximumConsecutiveMeetingMinutes;
  const results: Finding[] = [];
  for (const day of days) {
    const meetings = day.meetings;
    let run: CalendarEvent[] = [];
    const flush = (): void => {
      if (run.length === 0) return;
      const first = run[0];
      const last = run.at(-1);
      if (first && last) {
        const duration = minutesBetween(first.start, last.end);
        if (duration > maximum) {
          results.push(
            finding(
              "RL005",
              "warning",
              "Consecutive meeting run is too long",
              `${run.length} meetings occupy ${duration} consecutive minutes on ${day.date}; policy allows ${maximum}.`,
              `Insert a real break or split the run so no consecutive meeting span exceeds ${maximum} minutes.`,
              run,
              {
                date: day.date,
                count: run.length,
                minutes: duration,
                limitMinutes: maximum,
                eventLabels: eventEvidence(run, config),
              },
            ),
          );
        }
      }
      run = [];
    };
    for (const meeting of meetings) {
      const previous = run.at(-1);
      if (
        !previous ||
        meeting.start.getTime() - previous.end.getTime() <=
          config.policy.minimumTransitionMinutes * 60_000
      ) {
        run.push(meeting);
      } else {
        flush();
        run.push(meeting);
      }
    }
    flush();
  }
  return results;
}

function focusFindings(
  weeks: WeekMetrics[],
  config: RhythmLintConfig,
): Finding[] {
  const normalDays = config.workweek.days.length;
  return weeks.flatMap((week) => {
    const required = Math.ceil(
      (config.policy.minimumFocusBlocksPerWeek * week.workdays) / normalDays,
    );
    if (week.protectedFocusBlocks >= required) return [];
    return [
      finding(
        "RL006",
        "warning",
        "Not enough focus capacity",
        `Week ${week.weekStart} has ${week.protectedFocusBlocks} protected focus blocks; ${required} are required for its ${week.workdays} audited workdays.`,
        `Use the overlay command to reserve ${required - week.protectedFocusBlocks} additional block(s) of at least ${config.policy.minimumFocusBlockMinutes} minutes, then move meetings if free capacity is insufficient.`,
        [],
        {
          date: week.weekStart,
          count: week.protectedFocusBlocks,
          requiredCount: required,
          minutes: week.availableFocusMinutes,
          limitMinutes: config.policy.minimumFocusBlockMinutes,
        },
      ),
    ];
  });
}

function fragmentFindings(
  days: DayContext[],
  config: RhythmLintConfig,
): Finding[] {
  const limit = config.policy.maximumFragmentMinutesPerDay;
  return days
    .filter((day) => day.metrics.fragmentMinutes > limit)
    .map((day) =>
      finding(
        "RL007",
        "warning",
        "Free time is fragmented",
        `${day.metrics.fragmentMinutes} free minutes are split into blocks shorter than ${config.policy.minimumFocusBlockMinutes} minutes on ${day.date}.`,
        "Batch or move meetings so short gaps combine into one usable focus window.",
        day.active.filter((event) => event.kind !== "focus"),
        {
          date: day.date,
          minutes: day.metrics.fragmentMinutes,
          limitMinutes: limit,
          eventLabels: eventEvidence(
            day.active.filter((event) => event.kind !== "focus"),
            config,
          ),
        },
      ),
    );
}

function lunchFindings(
  days: DayContext[],
  config: RhythmLintConfig,
): Finding[] {
  const minimum = config.workweek.lunch.minimumMinutes;
  return days.flatMap((day) => {
    const longest = Math.max(
      0,
      ...day.lunchFree.map((interval) =>
        minutesBetween(interval.start, interval.end),
      ),
    );
    if (longest >= minimum) return [];
    const events = day.active.filter(
      (event) =>
        event.end >
          zonedDateTimeToUtc(
            day.date,
            config.workweek.lunch.earliest,
            config.timezone,
          ) &&
        event.start <
          zonedDateTimeToUtc(
            day.date,
            config.workweek.lunch.latest,
            config.timezone,
          ),
    );
    return [
      finding(
        "RL008",
        "warning",
        "Lunch window is squeezed",
        `The longest free interval between ${config.workweek.lunch.earliest} and ${config.workweek.lunch.latest} is ${longest} minutes on ${day.date}; policy requires ${minimum}.`,
        `Reserve at least ${minimum} uninterrupted minutes in the lunch window. The overlay command can hold an existing free interval; move events first when no interval fits.`,
        events,
        {
          date: day.date,
          minutes: longest,
          limitMinutes: minimum,
          eventLabels: eventEvidence(events, config),
        },
      ),
    ];
  });
}

function outsideHoursFindings(
  events: CalendarEvent[],
  config: RhythmLintConfig,
): Finding[] {
  const level = config.policy.outsideWorkHours;
  if (level === "off") return [];
  return events.filter(activeEvent).flatMap((event) => {
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: config.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(event.start)
      .replaceAll("/", "-");
    const weekday = weekdayForDateKey(date);
    const inWorkweek = config.workweek.days.includes(weekday);
    const work = inWorkweek ? workInterval(date, config) : undefined;
    if (work && event.start >= work.start && event.end <= work.end) return [];
    return [
      finding(
        "RL009",
        level,
        "Event falls outside working hours",
        `${eventLabel(event, config)} is not fully contained in the configured work window on ${date}.`,
        "Move the event into working hours, mark it transparent/ignored when appropriate, or deliberately adjust the workweek policy.",
        [event],
        {
          date,
          window: work
            ? `${isoMinute(work.start)} / ${isoMinute(work.end)}`
            : "non-working day",
          eventLabels: eventEvidence([event], config),
        },
      ),
    ];
  });
}

function calculateMetrics(
  events: CalendarEvent[],
  days: DayContext[],
  weeks: WeekMetrics[],
): AuditMetrics {
  const active = events.filter(activeEvent);
  return {
    eventCount: active.length,
    meetingCount: active.filter((event) => event.kind === "meeting").length,
    recurringOccurrenceCount: active.filter((event) => event.recurring).length,
    meetingMinutes: weeks.reduce(
      (total, week) => total + week.meetingMinutes,
      0,
    ),
    busyMinutes: days.reduce(
      (total, day) => total + day.metrics.busyMinutes,
      0,
    ),
    availableFocusMinutes: weeks.reduce(
      (total, week) => total + week.availableFocusMinutes,
      0,
    ),
    protectedFocusMinutes: days.reduce(
      (total, day) => total + day.metrics.protectedFocusMinutes,
      0,
    ),
    fragmentMinutes: days.reduce(
      (total, day) => total + day.metrics.fragmentMinutes,
      0,
    ),
    contextSwitches: days.reduce(
      (total, day) => total + day.metrics.contextSwitches,
      0,
    ),
    days: days.map((day) => day.metrics),
    weeks,
  };
}

export function analyzeParsed(
  parsed: ParseResult,
  window: AuditWindow,
  config: RhythmLintConfig,
  toolVersion = VERSION,
): AuditReport {
  const workdays = calendarDateBounds(window).filter((date) =>
    config.workweek.days.includes(weekdayForDateKey(date)),
  );
  const days = workdays.map((date) =>
    buildDayContext(date, parsed.events, config),
  );
  const weeks = weekMetrics(days);
  const findings = [
    ...overlapFindings(days, config),
    ...transitionFindings(days, config),
    ...dailyBudgetFindings(days, config),
    ...weeklyBudgetFindings(weeks, config),
    ...consecutiveMeetingFindings(days, config),
    ...focusFindings(weeks, config),
    ...fragmentFindings(days, config),
    ...lunchFindings(days, config),
    ...outsideHoursFindings(parsed.events, config),
  ].sort(
    (a, b) =>
      ({ error: 0, warning: 1, info: 2 })[a.severity] -
        { error: 0, warning: 1, info: 2 }[b.severity] ||
      a.ruleId.localeCompare(b.ruleId) ||
      a.fingerprint.localeCompare(b.fingerprint),
  );
  const diagnosticErrors = parsed.diagnostics.filter(
    (item) => item.severity === "error",
  ).length;
  const diagnosticWarnings = parsed.diagnostics.filter(
    (item) => item.severity === "warning",
  ).length;
  const errors =
    findings.filter((item) => item.severity === "error").length +
    diagnosticErrors;
  const warnings =
    findings.filter((item) => item.severity === "warning").length +
    diagnosticWarnings;
  const info = findings.filter((item) => item.severity === "info").length;
  return {
    schemaVersion: "rhythmlint.audit.v1",
    toolVersion,
    window: {
      from: window.fromDate,
      toExclusive: window.toDateExclusive,
      days: window.days,
      timezone: window.timezone,
    },
    config: structuredClone(config),
    inputs: structuredClone(parsed.inputHashes),
    diagnostics: structuredClone(parsed.diagnostics),
    metrics: calculateMetrics(parsed.events, days, weeks),
    findings,
    summary: {
      errors,
      warnings,
      info,
      score: Math.max(0, 100 - errors * 15 - warnings * 6 - info),
    },
    events: parsed.events.map((event) => sanitizeEvent(event, config)),
  };
}

export function auditDayContexts(
  events: CalendarEvent[],
  window: AuditWindow,
  config: RhythmLintConfig,
): Array<{
  date: string;
  work: Interval;
  active: CalendarEvent[];
  freeForFocus: Interval[];
  lunchFree: Interval[];
  metrics: DayMetrics;
}> {
  return calendarDateBounds(window)
    .filter((date) => config.workweek.days.includes(weekdayForDateKey(date)))
    .map((date) => buildDayContext(date, events, config));
}
