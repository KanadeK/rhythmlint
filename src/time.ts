import type { Interval } from "./types.js";

const formatters = new Map<string, Intl.DateTimeFormat>();

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

function formatter(timezone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timezone);
  if (cached) return cached;
  const created = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  formatters.set(timezone, created);
  return created;
}

const weekdays: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function assertTimezone(timezone: string): void {
  try {
    formatter(timezone).format(new Date(0));
  } catch {
    throw new Error(`Unknown IANA timezone: ${timezone}`);
  }
}

export function getZonedParts(date: Date, timezone: string): ZonedParts {
  const parts = formatter(timezone).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const weekday = weekdays[values.weekday ?? ""];
  if (weekday === undefined)
    throw new Error(`Unable to resolve weekday in ${timezone}`);
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    weekday,
  };
}

export function dateKey(date: Date, timezone: string): string {
  const part = getZonedParts(date, timezone);
  return `${part.year.toString().padStart(4, "0")}-${part.month.toString().padStart(2, "0")}-${part.day.toString().padStart(2, "0")}`;
}

export function timeKey(date: Date, timezone: string): string {
  const part = getZonedParts(date, timezone);
  return `${part.hour.toString().padStart(2, "0")}:${part.minute.toString().padStart(2, "0")}`;
}

export function parseDateKey(value: string): {
  year: number;
  month: number;
  day: number;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Expected YYYY-MM-DD, received: ${value}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return { year, month, day };
}

export function parseClock(value: string): { hour: number; minute: number } {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Expected HH:MM, received: ${value}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error(`Invalid clock time: ${value}`);
  return { hour, minute };
}

export function addDaysKey(value: string, amount: number): string {
  const { year, month, day } = parseDateKey(value);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

export function weekdayForDateKey(value: string): number {
  const { year, month, day } = parseDateKey(value);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function startOfWeekKey(value: string): string {
  const weekday = weekdayForDateKey(value);
  const distance = weekday === 0 ? 6 : weekday - 1;
  return addDaysKey(value, -distance);
}

export function zonedDateTimeToUtc(
  date: string,
  clock: string,
  timezone: string,
): Date {
  const { year, month, day } = parseDateKey(date);
  const { hour, minute } = parseClock(clock);
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = getZonedParts(new Date(guess), timezone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const delta = target - actualAsUtc;
    if (delta === 0) break;
    guess += delta;
  }
  const result = new Date(guess);
  const roundTrip = getZonedParts(result, timezone);
  if (
    roundTrip.year !== year ||
    roundTrip.month !== month ||
    roundTrip.day !== day ||
    roundTrip.hour !== hour ||
    roundTrip.minute !== minute
  ) {
    throw new Error(
      `Local time ${date} ${clock} does not exist in ${timezone}`,
    );
  }
  return result;
}

export function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
}

export function overlaps(left: Interval, right: Interval): boolean {
  return left.start < right.end && right.start < left.end;
}

export function intersection(
  left: Interval,
  right: Interval,
): Interval | undefined {
  const start = left.start > right.start ? left.start : right.start;
  const end = left.end < right.end ? left.end : right.end;
  return start < end ? { start, end } : undefined;
}

export function mergeIntervals(
  intervals: Interval[],
  touching = true,
): Interval[] {
  const sorted = [...intervals]
    .filter((item) => item.start < item.end)
    .sort(
      (a, b) =>
        a.start.getTime() - b.start.getTime() ||
        a.end.getTime() - b.end.getTime(),
    );
  const merged: Interval[] = [];
  for (const current of sorted) {
    const previous = merged.at(-1);
    const joins =
      previous &&
      (touching ? current.start <= previous.end : current.start < previous.end);
    if (!previous || !joins) {
      merged.push({
        start: new Date(current.start),
        end: new Date(current.end),
        ...(current.eventIds ? { eventIds: [...current.eventIds] } : {}),
        ...(current.kind ? { kind: current.kind } : {}),
      });
      continue;
    }
    if (current.end > previous.end) previous.end = new Date(current.end);
    if (current.eventIds)
      previous.eventIds = [
        ...new Set([...(previous.eventIds ?? []), ...current.eventIds]),
      ];
  }
  return merged;
}

export function subtractIntervals(
  container: Interval,
  blockers: Interval[],
): Interval[] {
  const clipped = mergeIntervals(
    blockers
      .map((blocker) => intersection(container, blocker))
      .filter((item): item is Interval => item !== undefined),
  );
  const free: Interval[] = [];
  let cursor = container.start;
  for (const blocker of clipped) {
    if (cursor < blocker.start)
      free.push({ start: new Date(cursor), end: new Date(blocker.start) });
    if (blocker.end > cursor) cursor = blocker.end;
  }
  if (cursor < container.end)
    free.push({ start: new Date(cursor), end: new Date(container.end) });
  return free;
}

export function isoMinute(date: Date): string {
  return date.toISOString().replace(/\.000Z$/, "Z");
}

export function utcIcs(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}
