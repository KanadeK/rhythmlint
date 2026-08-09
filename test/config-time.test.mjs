import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CONFIG,
  parseConfig,
  resolveAuditWindow,
  serializableDefaultConfig,
} from "../dist/config.js";
import {
  addDaysKey,
  dateKey,
  getZonedParts,
  intersection,
  mergeIntervals,
  minutesBetween,
  parseClock,
  parseDateKey,
  startOfWeekKey,
  subtractIntervals,
  weekdayForDateKey,
  zonedDateTimeToUtc,
} from "../dist/time.js";

test("default configuration is independent and valid", () => {
  const first = serializableDefaultConfig();
  first.workweek.days.push(0);
  const second = serializableDefaultConfig();
  assert.deepEqual(second.workweek.days, [1, 2, 3, 4, 5]);
  assert.equal(parseConfig(second).version, 1);
});

test("partial configuration deep-merges defaults", () => {
  const config = parseConfig({
    timezone: "UTC",
    policy: { minimumTransitionMinutes: 15 },
  });
  assert.equal(config.timezone, "UTC");
  assert.equal(config.policy.minimumTransitionMinutes, 15);
  assert.equal(
    config.policy.dailyMeetingBudgetMinutes,
    DEFAULT_CONFIG.policy.dailyMeetingBudgetMinutes,
  );
});

test("configuration validation rejects malformed boundaries", () => {
  assert.throws(() => parseConfig(null), /JSON object/);
  assert.throws(() => parseConfig({ version: 2 }), /version 1/);
  assert.throws(
    () => parseConfig({ timezone: "Not\/A_Zone" }),
    /Unknown IANA timezone/,
  );
  assert.throws(
    () => parseConfig({ workweek: { days: [8] } }),
    /weekday integers/,
  );
  assert.throws(
    () => parseConfig({ workweek: { start: "18:00", end: "09:00" } }),
    /earlier/,
  );
  assert.throws(
    () => parseConfig({ policy: { overlap: "fatal" } }),
    /error, warning/,
  );
  assert.throws(
    () => parseConfig({ matching: { focusTitlePatterns: ["["] } }),
    /invalid regular expression/,
  );
  assert.throws(
    () => parseConfig({ privacy: { redactTitles: "yes" } }),
    /true or false/,
  );
});

test("audit windows honor DST day length", () => {
  const config = parseConfig({ timezone: "America/Los_Angeles" });
  const spring = resolveAuditWindow(config, "2026-03-08", 1);
  const fall = resolveAuditWindow(config, "2026-11-01", 1);
  assert.equal(minutesBetween(spring.from, spring.to), 23 * 60);
  assert.equal(minutesBetween(fall.from, fall.to), 25 * 60);
  assert.throws(() => resolveAuditWindow(config, "2026-08-03", 0), /1 to 366/);
  assert.throws(
    () => resolveAuditWindow(config, "not-a-date", 7),
    /YYYY-MM-DD/,
  );
});

test("zoned conversion and date helpers are stable", () => {
  const utc = zonedDateTimeToUtc("2026-08-03", "09:30", "America/Los_Angeles");
  assert.equal(utc.toISOString(), "2026-08-03T16:30:00.000Z");
  assert.equal(dateKey(utc, "America/Los_Angeles"), "2026-08-03");
  assert.equal(getZonedParts(utc, "America/Los_Angeles").hour, 9);
  assert.throws(
    () => zonedDateTimeToUtc("2026-03-08", "02:30", "America/Los_Angeles"),
    /does not exist/,
  );
  assert.deepEqual(parseDateKey("2024-02-29"), {
    year: 2024,
    month: 2,
    day: 29,
  });
  assert.throws(() => parseDateKey("2023-02-29"), /Invalid calendar date/);
  assert.deepEqual(parseClock("23:59"), { hour: 23, minute: 59 });
  assert.throws(() => parseClock("24:00"), /Invalid clock/);
  assert.equal(addDaysKey("2026-12-31", 1), "2027-01-01");
  assert.equal(weekdayForDateKey("2026-08-03"), 1);
  assert.equal(startOfWeekKey("2026-08-09"), "2026-08-03");
});

test("interval helpers merge, intersect, and subtract", () => {
  const base = {
    start: new Date("2026-08-03T09:00:00Z"),
    end: new Date("2026-08-03T17:00:00Z"),
  };
  const blockers = [
    {
      start: new Date("2026-08-03T10:00:00Z"),
      end: new Date("2026-08-03T11:00:00Z"),
    },
    {
      start: new Date("2026-08-03T10:30:00Z"),
      end: new Date("2026-08-03T12:00:00Z"),
    },
    {
      start: new Date("2026-08-03T14:00:00Z"),
      end: new Date("2026-08-03T15:00:00Z"),
    },
  ];
  assert.equal(mergeIntervals(blockers).length, 2);
  assert.equal(
    minutesBetween(...Object.values(intersection(base, blockers[0]))),
    60,
  );
  assert.deepEqual(
    subtractIntervals(base, blockers).map((item) =>
      minutesBetween(item.start, item.end),
    ),
    [60, 120, 120],
  );
});
