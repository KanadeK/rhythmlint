import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";

import { analyzeParsed } from "../dist/analyze.js";
import { loadConfig, parseConfig, resolveAuditWindow } from "../dist/config.js";
import { parseCalendarFiles, parseCalendarInputs } from "../dist/ics.js";
import { RULES, ruleById } from "../dist/rules.js";
import { at, examples, reportFromEvents, utcConfig } from "./helpers.mjs";

test("overloaded example exercises every v0.1 rule", async () => {
  const config = await loadConfig(resolve(examples, "rhythmlint.config.json"));
  const window = resolveAuditWindow(config, "2026-08-03", 7);
  const parsed = await parseCalendarFiles(
    [resolve(examples, "before.ics")],
    window,
    config,
  );
  const report = analyzeParsed(parsed, window, config);
  assert.deepEqual(
    [...new Set(report.findings.map((item) => item.ruleId))].sort(),
    RULES.map((rule) => rule.id),
  );
  assert.equal(report.summary.errors, 3);
  assert.equal(report.metrics.recurringOccurrenceCount, 5);
  assert.equal(report.metrics.weeks[0].workdays, 5);
  assert.equal(report.metrics.weeks[0].protectedFocusBlocks, 1);
});

test("repaired example passes at 100", async () => {
  const config = await loadConfig(resolve(examples, "rhythmlint.config.json"));
  const window = resolveAuditWindow(config, "2026-08-03", 7);
  const parsed = await parseCalendarFiles(
    [resolve(examples, "after.ics")],
    window,
    config,
  );
  const report = analyzeParsed(parsed, window, config);
  assert.equal(report.summary.score, 100);
  assert.equal(report.findings.length, 0);
  assert.equal(report.metrics.protectedFocusMinutes, 450);
});

test("privacy settings redact titles and locations everywhere in report events", () => {
  const config = utcConfig({
    privacy: { redactTitles: true, redactLocations: true },
  });
  const { report } = reportFromEvents(
    [
      {
        start: at("2026-08-03T09:00:00Z"),
        end: at("2026-08-03T10:00:00Z"),
        summary: "Secret Review",
        uid: "private",
      },
    ],
    config,
  );
  const serialized = JSON.stringify(report);
  assert.ok(!serialized.includes("Secret Review"));
  assert.match(report.events[0].summary, /^Event [a-f0-9]{6}$/);
});

test("overlap and outside-hours rules can be disabled", () => {
  const config = utcConfig({
    policy: { overlap: "off", outsideWorkHours: "off" },
  });
  const { report } = reportFromEvents(
    [
      {
        start: at("2026-08-03T08:00:00Z"),
        end: at("2026-08-03T10:00:00Z"),
        summary: "Morning Sync",
        uid: "a",
      },
      {
        start: at("2026-08-03T09:00:00Z"),
        end: at("2026-08-03T11:00:00Z"),
        summary: "Review",
        uid: "b",
      },
    ],
    config,
  );
  assert.ok(
    !report.findings.some(
      (item) => item.ruleId === "RL001" || item.ruleId === "RL009",
    ),
  );
});

test("partial weeks scale focus requirements and meeting budget", () => {
  const config = utcConfig({
    policy: { minimumFocusBlocksPerWeek: 5, weeklyMeetingBudgetMinutes: 500 },
  });
  const { report } = reportFromEvents(
    [
      {
        start: at("2026-08-03T09:00:00Z"),
        end: at("2026-08-03T11:00:00Z"),
        summary: "Planning",
        uid: "a",
      },
    ],
    config,
    "2026-08-03",
    1,
  );
  const focus = report.findings.find((item) => item.ruleId === "RL006");
  const weekly = report.findings.find((item) => item.ruleId === "RL004");
  assert.equal(focus.evidence.requiredCount, 1);
  assert.equal(weekly.evidence.limitMinutes, 100);
});

test("diagnostics contribute to score and summary", () => {
  const config = utcConfig();
  const window = resolveAuditWindow(config, "2026-08-03", 1);
  const parsed = parseCalendarInputs(
    [
      {
        source: "broken.ics",
        text: `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:bad\nDTSTART:20260803T100000Z\nDTEND:20260803T100000Z\nSUMMARY:Bad\nEND:VEVENT\nEND:VCALENDAR`,
      },
    ],
    window,
    config,
  );
  const report = analyzeParsed(parsed, window, config);
  assert.equal(report.summary.errors, 1);
  assert.ok(report.summary.score < 100);
});

test("rule catalog lookup is stable", () => {
  assert.equal(ruleById("RL001").name, "event-overlap");
  assert.throws(() => ruleById("RL999"), /Unknown rule/);
});
