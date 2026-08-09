import { resolve } from "node:path";

import { analyzeParsed } from "../dist/analyze.js";
import {
  DEFAULT_CONFIG,
  parseConfig,
  resolveAuditWindow,
} from "../dist/config.js";
import { makeSyntheticCalendar, parseCalendarInputs } from "../dist/ics.js";

export const root = resolve(import.meta.dirname, "..");
export const examples = resolve(root, "examples");

export function utcConfig(override = {}) {
  return parseConfig({
    ...structuredClone(DEFAULT_CONFIG),
    timezone: "UTC",
    workweek: {
      ...structuredClone(DEFAULT_CONFIG.workweek),
      start: "09:00",
      end: "17:00",
      lunch: { earliest: "12:00", latest: "14:00", minimumMinutes: 30 },
    },
    policy: {
      ...structuredClone(DEFAULT_CONFIG.policy),
      dailyMeetingBudgetMinutes: 180,
      weeklyMeetingBudgetMinutes: 600,
      maximumConsecutiveMeetingMinutes: 90,
      minimumFocusBlockMinutes: 90,
      minimumFocusBlocksPerWeek: 3,
      maximumFragmentMinutesPerDay: 45,
    },
    ...override,
  });
}

export function reportFromEvents(
  events,
  config = utcConfig(),
  from = "2026-08-03",
  days = 7,
) {
  const window = resolveAuditWindow(config, from, days);
  const text = makeSyntheticCalendar(events);
  const parsed = parseCalendarInputs(
    [{ source: "synthetic.ics", text }],
    window,
    config,
  );
  return {
    report: analyzeParsed(parsed, window, config),
    parsed,
    window,
    text,
  };
}

export function at(iso) {
  return new Date(iso);
}
