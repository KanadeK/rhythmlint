import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import ICAL from "ical.js";

import { addDaysKey, dateKey, zonedDateTimeToUtc } from "./time.js";
import type {
  AuditWindow,
  CalendarEvent,
  EventKind,
  ParseDiagnostic,
  ParseResult,
  RhythmLintConfig,
} from "./types.js";

const MAX_OCCURRENCES_PER_SERIES = 25_000;

interface CalendarInput {
  source: string;
  text: string;
}

interface IcalTimeLike {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  isDate: boolean;
  zone: { tzid: string };
  toJSDate(): Date;
  toString(): string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableEventId(
  uid: string,
  recurrenceId: string | undefined,
  start: Date,
): string {
  return sha256(`${uid}\0${recurrenceId ?? ""}\0${start.toISOString()}`).slice(
    0,
    20,
  );
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function registerTimezones(
  calendar: InstanceType<typeof ICAL.Component>,
  diagnostics: ParseDiagnostic[],
  source: string,
): void {
  for (const component of calendar.getAllSubcomponents("vtimezone")) {
    const tzid = stringValue(component.getFirstPropertyValue("tzid"));
    if (!tzid) {
      diagnostics.push({
        source,
        severity: "warning",
        code: "ICS_TIMEZONE_WITHOUT_ID",
        message: "Ignored a VTIMEZONE component without TZID.",
      });
      continue;
    }
    try {
      ICAL.TimezoneService.register(component, tzid);
    } catch (error) {
      diagnostics.push({
        source,
        severity: "warning",
        code: "ICS_TIMEZONE_INVALID",
        message: `Unable to register timezone ${tzid}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
}

function timeToDate(
  value: IcalTimeLike,
  fallbackTimezone: string,
  diagnostics: ParseDiagnostic[],
  source: string,
  uid: string,
): Date {
  const tzid = value.zone?.tzid ?? "floating";
  if (tzid === "UTC" || tzid === "Z" || tzid === "GMT") return value.toJSDate();
  if (tzid !== "floating" && ICAL.TimezoneService.has(tzid))
    return value.toJSDate();
  const date = `${value.year.toString().padStart(4, "0")}-${value.month.toString().padStart(2, "0")}-${value.day.toString().padStart(2, "0")}`;
  const clock = value.isDate
    ? "00:00"
    : `${value.hour.toString().padStart(2, "0")}:${value.minute.toString().padStart(2, "0")}`;
  const requestedTimezone = tzid === "floating" ? fallbackTimezone : tzid;
  try {
    return zonedDateTimeToUtc(date, clock, requestedTimezone);
  } catch {
    diagnostics.push({
      source,
      severity: "warning",
      code: "ICS_UNKNOWN_TZID",
      uid,
      message: `TZID ${requestedTimezone} is unavailable; interpreted the occurrence in ${fallbackTimezone}.`,
    });
    return zonedDateTimeToUtc(date, clock, fallbackTimezone);
  }
}

function classify(
  summary: string,
  attendees: number,
  config: RhythmLintConfig,
): EventKind {
  const matches = (patterns: string[]): boolean =>
    patterns.some((pattern) => new RegExp(pattern, "i").test(summary));
  if (matches(config.matching.ignoreTitlePatterns)) return "ignored";
  if (matches(config.matching.focusTitlePatterns)) return "focus";
  if (
    attendees > 0 ||
    matches(config.matching.meetingTitlePatterns) ||
    config.matching.countAppointmentsAsMeetings
  ) {
    return "meeting";
  }
  return "appointment";
}

function componentFlags(component: InstanceType<typeof ICAL.Component>): {
  transparent: boolean;
  cancelled: boolean;
} {
  const transparent =
    stringValue(component.getFirstPropertyValue("transp")).toUpperCase() ===
    "TRANSPARENT";
  const cancelled =
    stringValue(component.getFirstPropertyValue("status")).toUpperCase() ===
    "CANCELLED";
  return { transparent, cancelled };
}

function makeEvent(
  item: InstanceType<typeof ICAL.Event>,
  startTime: IcalTimeLike,
  endTime: IcalTimeLike,
  recurrenceId: string | undefined,
  recurring: boolean,
  source: string,
  config: RhythmLintConfig,
  diagnostics: ParseDiagnostic[],
): CalendarEvent | undefined {
  const uid =
    item.uid ||
    `missing-uid-${sha256(`${source}\0${startTime.toString()}\0${item.summary}`).slice(0, 12)}`;
  const start = timeToDate(
    startTime,
    config.timezone,
    diagnostics,
    source,
    uid,
  );
  const end = timeToDate(endTime, config.timezone, diagnostics, source, uid);
  if (!(start < end)) {
    diagnostics.push({
      source,
      severity: "error",
      code: "ICS_NON_POSITIVE_DURATION",
      uid,
      message: `Skipped event ${uid} because its end is not later than its start.`,
    });
    return undefined;
  }
  const summary = item.summary?.trim() || "(untitled event)";
  const location = item.location?.trim() || "";
  const attendees = item.attendees.length;
  const flags = componentFlags(item.component);
  return {
    id: stableEventId(uid, recurrenceId, start),
    uid,
    ...(recurrenceId ? { recurrenceId } : {}),
    summary,
    location,
    start,
    end,
    allDay: startTime.isDate,
    transparent: flags.transparent,
    cancelled: flags.cancelled,
    recurring,
    attendees,
    source,
    kind: classify(summary, attendees, config),
  };
}

function parseOne(
  input: CalendarInput,
  window: AuditWindow,
  config: RhythmLintConfig,
): {
  events: CalendarEvent[];
  diagnostics: ParseDiagnostic[];
} {
  const diagnostics: ParseDiagnostic[] = [];
  let calendar: InstanceType<typeof ICAL.Component>;
  try {
    calendar = new ICAL.Component(ICAL.parse(input.text));
  } catch (error) {
    throw new Error(
      `Unable to parse ${input.source}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (calendar.name !== "vcalendar")
    throw new Error(
      `${input.source} does not contain a VCALENDAR root component`,
    );
  registerTimezones(calendar, diagnostics, input.source);
  const events: CalendarEvent[] = [];
  for (const component of calendar.getAllSubcomponents("vevent")) {
    const item = new ICAL.Event(component);
    if (item.isRecurrenceException()) continue;
    if (item.isRecurring()) {
      const iterator = item.iterator();
      let count = 0;
      let occurrence: ReturnType<typeof iterator.next> | null;
      while ((occurrence = iterator.next())) {
        count += 1;
        if (count > MAX_OCCURRENCES_PER_SERIES) {
          diagnostics.push({
            source: input.source,
            severity: "error",
            code: "ICS_RECURRENCE_LIMIT",
            uid: item.uid,
            message: `Stopped expanding ${item.uid} after ${MAX_OCCURRENCES_PER_SERIES.toLocaleString("en-US")} occurrences. Narrow the audit window or recurrence rule.`,
          });
          break;
        }
        const details = item.getOccurrenceDetails(occurrence);
        const start = timeToDate(
          details.startDate,
          config.timezone,
          diagnostics,
          input.source,
          item.uid,
        );
        if (start >= window.to) break;
        const end = timeToDate(
          details.endDate,
          config.timezone,
          diagnostics,
          input.source,
          item.uid,
        );
        if (end <= window.from) continue;
        const parsed = makeEvent(
          details.item,
          details.startDate,
          details.endDate,
          details.recurrenceId.toString(),
          true,
          input.source,
          config,
          diagnostics,
        );
        if (parsed) events.push(parsed);
      }
      continue;
    }
    const start = timeToDate(
      item.startDate,
      config.timezone,
      diagnostics,
      input.source,
      item.uid,
    );
    const end = timeToDate(
      item.endDate,
      config.timezone,
      diagnostics,
      input.source,
      item.uid,
    );
    if (end <= window.from || start >= window.to) continue;
    const parsed = makeEvent(
      item,
      item.startDate,
      item.endDate,
      undefined,
      false,
      input.source,
      config,
      diagnostics,
    );
    if (parsed) events.push(parsed);
  }
  return { events, diagnostics };
}

export function parseCalendarInputs(
  inputs: CalendarInput[],
  window: AuditWindow,
  config: RhythmLintConfig,
): ParseResult {
  ICAL.TimezoneService.reset();
  const allEvents: CalendarEvent[] = [];
  const diagnostics: ParseDiagnostic[] = [];
  const inputHashes = inputs.map((input) => ({
    source: input.source,
    sha256: sha256(input.text),
  }));
  for (const input of inputs) {
    const parsed = parseOne(input, window, config);
    allEvents.push(...parsed.events);
    diagnostics.push(...parsed.diagnostics);
  }
  const unique = new Map<string, CalendarEvent>();
  for (const event of allEvents.sort(
    (a, b) => a.start.getTime() - b.start.getTime() || a.id.localeCompare(b.id),
  )) {
    const key = `${event.uid}\0${event.recurrenceId ?? ""}\0${event.start.toISOString()}`;
    const previous = unique.get(key);
    if (!previous) {
      unique.set(key, event);
      continue;
    }
    diagnostics.push({
      source: event.source,
      severity: "warning",
      code: "ICS_DUPLICATE_OCCURRENCE",
      uid: event.uid,
      message: `Deduplicated an occurrence already supplied by ${previous.source}.`,
    });
  }
  return {
    events: [...unique.values()],
    diagnostics: diagnostics.sort((a, b) =>
      `${a.source}\0${a.code}\0${a.uid ?? ""}`.localeCompare(
        `${b.source}\0${b.code}\0${b.uid ?? ""}`,
      ),
    ),
    inputHashes: inputHashes.sort((a, b) => a.source.localeCompare(b.source)),
  };
}

export async function parseCalendarFiles(
  paths: string[],
  window: AuditWindow,
  config: RhythmLintConfig,
): Promise<ParseResult> {
  if (paths.length === 0) throw new Error("At least one ICS file is required");
  const inputs: CalendarInput[] = [];
  for (const path of paths) {
    const absolute = resolve(path);
    let text: string;
    try {
      text = await readFile(absolute, "utf8");
    } catch (error) {
      throw new Error(
        `Unable to read calendar ${absolute}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    inputs.push({ source: basename(path), text });
  }
  return parseCalendarInputs(inputs, window, config);
}

export function makeSyntheticCalendar(
  events: Array<{ start: Date; end: Date; summary: string; uid?: string }>,
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RhythmLint//Synthetic fixture//EN",
  ];
  for (const [index, event] of events.entries()) {
    const format = (date: Date): string =>
      date
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid ?? `synthetic-${index + 1}@rhythmlint`}`,
      `DTSTART:${format(event.start)}`,
      `DTEND:${format(event.end)}`,
      `SUMMARY:${event.summary.replace(/([,;\\])/g, "\\$1")}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR", "");
  return lines.join("\r\n");
}

export function calendarDateBounds(window: AuditWindow): string[] {
  return Array.from({ length: window.days }, (_, index) =>
    addDaysKey(window.fromDate, index),
  );
}

export function eventDate(
  event: CalendarEvent,
  config: RhythmLintConfig,
): string {
  return dateKey(event.start, config.timezone);
}
