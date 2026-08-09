import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  addDaysKey,
  assertTimezone,
  dateKey,
  parseClock,
  parseDateKey,
  zonedDateTimeToUtc,
} from "./time.js";
import type { AuditWindow, RhythmLintConfig, RuleLevel } from "./types.js";

export const DEFAULT_CONFIG: RhythmLintConfig = {
  $schema: "./rhythmlint.schema.json",
  version: 1,
  timezone: "America/Los_Angeles",
  workweek: {
    days: [1, 2, 3, 4, 5],
    start: "09:00",
    end: "17:30",
    lunch: {
      earliest: "11:30",
      latest: "14:00",
      minimumMinutes: 30,
    },
  },
  policy: {
    overlap: "error",
    minimumTransitionMinutes: 10,
    dailyMeetingBudgetMinutes: 240,
    weeklyMeetingBudgetMinutes: 900,
    maximumConsecutiveMeetingMinutes: 120,
    minimumFocusBlockMinutes: 90,
    minimumFocusBlocksPerWeek: 3,
    maximumFragmentMinutesPerDay: 60,
    outsideWorkHours: "warning",
  },
  matching: {
    ignoreTitlePatterns: ["^OOO$", "vacation", "holiday"],
    focusTitlePatterns: ["deep[ -]?work", "focus(?: time| block)?"],
    meetingTitlePatterns: [
      "stand[ -]?up",
      "sync",
      "review",
      "retro",
      "planning",
      "1[: -]?1",
    ],
    countAppointmentsAsMeetings: false,
  },
  privacy: {
    redactTitles: false,
    redactLocations: false,
  },
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeObject(base: JsonObject, override: JsonObject): JsonObject {
  const result: JsonObject = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    const existing = result[key];
    result[key] =
      isObject(existing) && isObject(value)
        ? mergeObject(existing, value)
        : structuredClone(value);
  }
  return result;
}

function requireNumber(value: unknown, path: string, minimum = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) {
    throw new Error(
      `${path} must be a number greater than or equal to ${minimum}`,
    );
  }
  return value;
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean")
    throw new Error(`${path} must be true or false`);
  return value;
}

function requireStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${path} must be an array of strings`);
  }
  for (const pattern of value) {
    try {
      new RegExp(pattern, "i");
    } catch {
      throw new Error(
        `${path} contains an invalid regular expression: ${pattern}`,
      );
    }
  }
  return [...value];
}

function requireLevel(value: unknown, path: string): RuleLevel {
  if (
    value !== "error" &&
    value !== "warning" &&
    value !== "info" &&
    value !== "off"
  ) {
    throw new Error(`${path} must be error, warning, info, or off`);
  }
  return value;
}

export function parseConfig(value: unknown): RhythmLintConfig {
  if (!isObject(value)) throw new Error("Configuration must be a JSON object");
  const merged = mergeObject(DEFAULT_CONFIG as unknown as JsonObject, value);
  const workweek = merged.workweek;
  const policy = merged.policy;
  const matching = merged.matching;
  const privacy = merged.privacy;
  if (!isObject(workweek) || !isObject(workweek.lunch))
    throw new Error("workweek and workweek.lunch are required");
  if (!isObject(policy) || !isObject(matching) || !isObject(privacy)) {
    throw new Error("policy, matching, and privacy must be JSON objects");
  }
  if (merged.version !== 1)
    throw new Error("Only config version 1 is supported");
  if (typeof merged.timezone !== "string")
    throw new Error("timezone must be an IANA timezone string");
  assertTimezone(merged.timezone);
  if (
    !Array.isArray(workweek.days) ||
    workweek.days.length === 0 ||
    workweek.days.some(
      (item) => !Number.isInteger(item) || Number(item) < 0 || Number(item) > 6,
    )
  ) {
    throw new Error(
      "workweek.days must contain weekday integers from 0 (Sunday) to 6 (Saturday)",
    );
  }
  const days = [...new Set(workweek.days as number[])].sort();
  if (typeof workweek.start !== "string" || typeof workweek.end !== "string") {
    throw new Error("workweek.start and workweek.end must be HH:MM strings");
  }
  parseClock(workweek.start);
  parseClock(workweek.end);
  if (workweek.start >= workweek.end)
    throw new Error("workweek.start must be earlier than workweek.end");
  const lunch = workweek.lunch;
  if (typeof lunch.earliest !== "string" || typeof lunch.latest !== "string") {
    throw new Error("workweek.lunch earliest/latest must be HH:MM strings");
  }
  parseClock(lunch.earliest);
  parseClock(lunch.latest);
  if (lunch.earliest >= lunch.latest)
    throw new Error("lunch.earliest must be earlier than lunch.latest");

  return {
    ...(typeof merged.$schema === "string" ? { $schema: merged.$schema } : {}),
    version: 1,
    timezone: merged.timezone,
    workweek: {
      days,
      start: workweek.start,
      end: workweek.end,
      lunch: {
        earliest: lunch.earliest,
        latest: lunch.latest,
        minimumMinutes: requireNumber(
          lunch.minimumMinutes,
          "workweek.lunch.minimumMinutes",
          1,
        ),
      },
    },
    policy: {
      overlap: requireLevel(policy.overlap, "policy.overlap"),
      minimumTransitionMinutes: requireNumber(
        policy.minimumTransitionMinutes,
        "policy.minimumTransitionMinutes",
      ),
      dailyMeetingBudgetMinutes: requireNumber(
        policy.dailyMeetingBudgetMinutes,
        "policy.dailyMeetingBudgetMinutes",
        1,
      ),
      weeklyMeetingBudgetMinutes: requireNumber(
        policy.weeklyMeetingBudgetMinutes,
        "policy.weeklyMeetingBudgetMinutes",
        1,
      ),
      maximumConsecutiveMeetingMinutes: requireNumber(
        policy.maximumConsecutiveMeetingMinutes,
        "policy.maximumConsecutiveMeetingMinutes",
        1,
      ),
      minimumFocusBlockMinutes: requireNumber(
        policy.minimumFocusBlockMinutes,
        "policy.minimumFocusBlockMinutes",
        1,
      ),
      minimumFocusBlocksPerWeek: requireNumber(
        policy.minimumFocusBlocksPerWeek,
        "policy.minimumFocusBlocksPerWeek",
      ),
      maximumFragmentMinutesPerDay: requireNumber(
        policy.maximumFragmentMinutesPerDay,
        "policy.maximumFragmentMinutesPerDay",
      ),
      outsideWorkHours: requireLevel(
        policy.outsideWorkHours,
        "policy.outsideWorkHours",
      ),
    },
    matching: {
      ignoreTitlePatterns: requireStringArray(
        matching.ignoreTitlePatterns,
        "matching.ignoreTitlePatterns",
      ),
      focusTitlePatterns: requireStringArray(
        matching.focusTitlePatterns,
        "matching.focusTitlePatterns",
      ),
      meetingTitlePatterns: requireStringArray(
        matching.meetingTitlePatterns,
        "matching.meetingTitlePatterns",
      ),
      countAppointmentsAsMeetings: requireBoolean(
        matching.countAppointmentsAsMeetings,
        "matching.countAppointmentsAsMeetings",
      ),
    },
    privacy: {
      redactTitles: requireBoolean(
        privacy.redactTitles,
        "privacy.redactTitles",
      ),
      redactLocations: requireBoolean(
        privacy.redactLocations,
        "privacy.redactLocations",
      ),
    },
  };
}

export async function loadConfig(path?: string): Promise<RhythmLintConfig> {
  if (!path) return structuredClone(DEFAULT_CONFIG);
  const absolute = resolve(path);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(absolute, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read configuration ${absolute}: ${message}`);
  }
  return parseConfig(parsed);
}

export function resolveAuditWindow(
  config: RhythmLintConfig,
  from?: string,
  days = 7,
): AuditWindow {
  if (!Number.isInteger(days) || days < 1 || days > 366)
    throw new Error("days must be an integer from 1 to 366");
  const fromDate = from ?? dateKey(new Date(), config.timezone);
  parseDateKey(fromDate);
  const toDateExclusive = addDaysKey(fromDate, days);
  return {
    from: zonedDateTimeToUtc(fromDate, "00:00", config.timezone),
    to: zonedDateTimeToUtc(toDateExclusive, "00:00", config.timezone),
    fromDate,
    toDateExclusive,
    days,
    timezone: config.timezone,
  };
}

export function serializableDefaultConfig(): RhythmLintConfig {
  return structuredClone(DEFAULT_CONFIG);
}
