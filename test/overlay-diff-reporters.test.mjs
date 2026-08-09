import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";

import { analyzeParsed } from "../dist/analyze.js";
import { loadConfig, resolveAuditWindow } from "../dist/config.js";
import { diffReports } from "../dist/diff.js";
import { parseCalendarFiles, parseCalendarInputs } from "../dist/ics.js";
import { generateOverlay } from "../dist/overlay.js";
import {
  renderAudit,
  renderAuditConsole,
  renderAuditHtml,
  renderAuditMarkdown,
  renderDiff,
  renderDiffConsole,
  renderDiffHtml,
  renderDiffMarkdown,
} from "../dist/reporters.js";
import { at, examples, reportFromEvents, utcConfig } from "./helpers.mjs";

test("overlay is deterministic, importable, and conflict-free on an empty week", () => {
  const config = utcConfig();
  const { parsed, window } = reportFromEvents([], config);
  const first = generateOverlay(parsed.events, window, config);
  const second = generateOverlay(parsed.events, window, config);
  assert.equal(first.ics, second.ics);
  assert.ok(first.ics.split("\r\n").every((line) => !line.endsWith(" ")));
  assert.equal(first.unresolvedFocusBlocks, 0);
  assert.equal(first.holds.filter((item) => item.kind === "focus").length, 3);
  assert.equal(first.holds.filter((item) => item.kind === "lunch").length, 5);
  const reparsed = parseCalendarInputs(
    [{ source: "overlay.ics", text: first.ics }],
    window,
    config,
  );
  assert.equal(reparsed.events.length, 8);
  assert.ok(
    reparsed.events.every((event) => event.summary.startsWith("RhythmLint:")),
  );
});

test("overlay reports unresolved focus when no free block exists", () => {
  const config = utcConfig({
    workweek: {
      days: [1],
      start: "09:00",
      end: "12:00",
      lunch: { earliest: "11:00", latest: "12:00", minimumMinutes: 30 },
    },
  });
  const { parsed, window } = reportFromEvents(
    [
      {
        start: at("2026-08-03T09:00:00Z"),
        end: at("2026-08-03T12:00:00Z"),
        summary: "Planning",
        uid: "full",
      },
    ],
    config,
    "2026-08-03",
    1,
  );
  const overlay = generateOverlay(parsed.events, window, config, false);
  assert.equal(overlay.holds.length, 0);
  assert.ok(overlay.unresolvedFocusBlocks > 0);
});

test("calendar diff quantifies improvements and guards window mismatch", async () => {
  const config = await loadConfig(resolve(examples, "rhythmlint.config.json"));
  const window = resolveAuditWindow(config, "2026-08-03", 7);
  const before = analyzeParsed(
    await parseCalendarFiles([resolve(examples, "before.ics")], window, config),
    window,
    config,
  );
  const after = analyzeParsed(
    await parseCalendarFiles([resolve(examples, "after.ics")], window, config),
    window,
    config,
  );
  const diff = diffReports(before, after);
  assert.equal(diff.deltas.score, 100);
  assert.ok(diff.deltas.meetingMinutes < 0);
  assert.ok(diff.resolvedFindings.length > 0);
  assert.equal(diff.introducedFindings.length, 0);
  const wrong = structuredClone(after);
  wrong.window.from = "2026-08-04";
  assert.throws(() => diffReports(before, wrong), /identical audit windows/);
});

test("all audit reporters return useful deterministic output", () => {
  const config = utcConfig();
  const { report } = reportFromEvents(
    [
      {
        start: at("2026-08-03T09:00:00Z"),
        end: at("2026-08-03T10:00:00Z"),
        summary: "<script>alert(1)</script> Review",
        uid: "x",
      },
      {
        start: at("2026-08-03T09:30:00Z"),
        end: at("2026-08-03T10:30:00Z"),
        summary: "Design Sync",
        uid: "y",
      },
    ],
    config,
  );
  const consoleText = renderAuditConsole(report);
  const markdown = renderAuditMarkdown(report);
  const html = renderAuditHtml(report);
  assert.match(consoleText, /RhythmLint/);
  assert.match(markdown, /# RhythmLint audit/);
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.equal(renderAudit(report, "console"), consoleText);
  assert.equal(renderAudit(report, "markdown"), markdown);
  assert.equal(renderAudit(report, "html"), html);
  assert.deepEqual(
    JSON.parse(renderAudit(report, "json")).summary,
    report.summary,
  );
});

test("all diff reporters summarize resolved and introduced findings", () => {
  const config = utcConfig();
  const before = reportFromEvents(
    [
      {
        start: at("2026-08-03T09:00:00Z"),
        end: at("2026-08-03T11:00:00Z"),
        summary: "Planning",
        uid: "a",
      },
      {
        start: at("2026-08-03T10:00:00Z"),
        end: at("2026-08-03T12:00:00Z"),
        summary: "Review",
        uid: "b",
      },
    ],
    config,
  ).report;
  const after = reportFromEvents([], config).report;
  const diff = diffReports(before, after);
  assert.match(renderDiffConsole(diff), /resolved/i);
  assert.match(renderDiffMarkdown(diff), /Resolved findings/);
  assert.match(renderDiffHtml(diff), /Did the week get better/);
  assert.equal(renderDiff(diff, "console"), renderDiffConsole(diff));
  assert.equal(renderDiff(diff, "markdown"), renderDiffMarkdown(diff));
  assert.equal(renderDiff(diff, "html"), renderDiffHtml(diff));
  assert.equal(
    JSON.parse(renderDiff(diff, "json")).schemaVersion,
    "rhythmlint.diff.v1",
  );
});
