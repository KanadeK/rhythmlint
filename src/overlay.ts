import { createHash } from "node:crypto";

import { auditDayContexts } from "./analyze.js";
import {
  intersection,
  minutesBetween,
  startOfWeekKey,
  subtractIntervals,
  utcIcs,
  zonedDateTimeToUtc,
} from "./time.js";
import type {
  AuditWindow,
  CalendarEvent,
  Interval,
  RhythmLintConfig,
} from "./types.js";

export interface OverlayHold {
  kind: "focus" | "lunch";
  start: Date;
  end: Date;
  uid: string;
  ruleId: "RL006" | "RL008";
}

export interface OverlayResult {
  ics: string;
  holds: OverlayHold[];
  unresolvedFocusBlocks: number;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function eventIntervals(
  events: CalendarEvent[],
  container: Interval,
): Interval[] {
  return events
    .filter(
      (event) =>
        !event.allDay &&
        !event.transparent &&
        !event.cancelled &&
        event.kind !== "ignored",
    )
    .map((event) =>
      intersection(container, { start: event.start, end: event.end }),
    )
    .filter((item): item is Interval => item !== undefined);
}

function hold(
  kind: "focus" | "lunch",
  start: Date,
  minutes: number,
  policyHash: string,
): OverlayHold {
  const end = new Date(start.getTime() + minutes * 60_000);
  const ruleId = kind === "focus" ? "RL006" : "RL008";
  const uid = `${hash(`${kind}\0${start.toISOString()}\0${end.toISOString()}\0${policyHash}`).slice(0, 24)}@rhythmlint`;
  return { kind, start, end, uid, ruleId };
}

function escapeIcs(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function fold(line: string): string[] {
  const width = 73;
  if (line.length <= width) return [line];
  const output: string[] = [];
  let remaining = line;
  while (remaining.length > width) {
    let chunk = remaining.slice(0, width);
    let rest = remaining.slice(width);
    while (chunk.endsWith(" ")) {
      chunk = chunk.slice(0, -1);
      rest = ` ${rest}`;
    }
    output.push(chunk);
    remaining = ` ${rest}`;
  }
  output.push(remaining);
  return output;
}

function serialize(
  holds: OverlayHold[],
  window: AuditWindow,
  policyHash: string,
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "PRODID:-//RhythmLint//Repair Overlay 0.1.0//EN",
    "X-WR-CALNAME:RhythmLint repair overlay",
  ];
  for (const item of holds.sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() || a.kind.localeCompare(b.kind),
  )) {
    const summary =
      item.kind === "focus"
        ? "RhythmLint: protected focus"
        : "RhythmLint: lunch hold";
    const description =
      item.kind === "focus"
        ? "Tentative hold generated from existing free capacity. Review before importing."
        : "Tentative lunch hold generated from an existing free interval. Review before importing.";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${item.uid}`,
      `DTSTAMP:${utcIcs(window.from)}`,
      `DTSTART:${utcIcs(item.start)}`,
      `DTEND:${utcIcs(item.end)}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      "STATUS:TENTATIVE",
      "TRANSP:OPAQUE",
      `CATEGORIES:RHYTHMLINT,${item.kind.toUpperCase()}`,
      `X-RHYTHMLINT-RULE:${item.ruleId}`,
      `X-RHYTHMLINT-POLICY-SHA256:${policyHash}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.flatMap(fold).join("\r\n")}\r\n`;
}

export function generateOverlay(
  events: CalendarEvent[],
  window: AuditWindow,
  config: RhythmLintConfig,
  includeLunch = true,
): OverlayResult {
  const policyHash = hash(JSON.stringify(config));
  const contexts = auditDayContexts(events, window, config);
  const holds: OverlayHold[] = [];

  if (includeLunch) {
    for (const day of contexts) {
      const candidate = day.lunchFree.find(
        (interval) =>
          minutesBetween(interval.start, interval.end) >=
          config.workweek.lunch.minimumMinutes,
      );
      if (candidate)
        holds.push(
          hold(
            "lunch",
            candidate.start,
            config.workweek.lunch.minimumMinutes,
            policyHash,
          ),
        );
    }
  }

  let unresolvedFocusBlocks = 0;
  const byWeek = new Map<string, typeof contexts>();
  for (const day of contexts) {
    const week = startOfWeekKey(day.date);
    byWeek.set(week, [...(byWeek.get(week) ?? []), day]);
  }
  for (const weekDays of byWeek.values()) {
    const required = Math.ceil(
      (config.policy.minimumFocusBlocksPerWeek * weekDays.length) /
        config.workweek.days.length,
    );
    const protectedCount = weekDays.reduce(
      (sum, day) => sum + day.metrics.protectedFocusBlocks,
      0,
    );
    let needed = Math.max(0, required - protectedCount);
    const candidates: Array<{ date: string; interval: Interval }> = [];
    for (const day of weekDays) {
      const lunch: Interval = {
        start: zonedDateTimeToUtc(
          day.date,
          config.workweek.lunch.earliest,
          config.timezone,
        ),
        end: zonedDateTimeToUtc(
          day.date,
          config.workweek.lunch.latest,
          config.timezone,
        ),
      };
      const blockers = [...eventIntervals(day.active, day.work), lunch];
      for (const interval of subtractIntervals(day.work, blockers)) {
        if (
          minutesBetween(interval.start, interval.end) >=
          config.policy.minimumFocusBlockMinutes
        ) {
          candidates.push({ date: day.date, interval });
        }
      }
    }
    candidates.sort(
      (a, b) =>
        minutesBetween(b.interval.start, b.interval.end) -
          minutesBetween(a.interval.start, a.interval.end) ||
        a.date.localeCompare(b.date) ||
        a.interval.start.getTime() - b.interval.start.getTime(),
    );
    const usedDates = new Set<string>();
    for (const candidate of candidates) {
      if (needed === 0) break;
      if (usedDates.has(candidate.date)) continue;
      holds.push(
        hold(
          "focus",
          candidate.interval.start,
          config.policy.minimumFocusBlockMinutes,
          policyHash,
        ),
      );
      usedDates.add(candidate.date);
      needed -= 1;
    }
    unresolvedFocusBlocks += needed;
  }

  return {
    ics: serialize(holds, window, policyHash),
    holds,
    unresolvedFocusBlocks,
  };
}
