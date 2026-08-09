import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeParsed } from "../dist/analyze.js";
import { loadConfig, resolveAuditWindow } from "../dist/config.js";
import { diffReports } from "../dist/diff.js";
import { parseCalendarFiles } from "../dist/ics.js";
import { generateOverlay } from "../dist/overlay.js";
import {
  renderAuditHtml,
  renderAuditMarkdown,
  renderDiffHtml,
  renderDiffMarkdown,
} from "../dist/reporters.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const examples = resolve(root, "examples");
const docs = resolve(root, "docs");
const config = await loadConfig(resolve(examples, "rhythmlint.config.json"));
const window = resolveAuditWindow(config, "2026-08-03", 7);

async function audit(name) {
  const parsed = await parseCalendarFiles(
    [resolve(examples, name)],
    window,
    config,
  );
  return analyzeParsed(parsed, window, config, "0.1.0");
}

const before = await audit("before.ics");
const after = await audit("after.ics");
const comparison = diffReports(before, after);
const beforeParsed = await parseCalendarFiles(
  [resolve(examples, "before.ics")],
  window,
  config,
);
const overlay = generateOverlay(beforeParsed.events, window, config);

const outputs = new Map([
  [resolve(docs, "index.html"), renderAuditHtml(before)],
  [resolve(docs, "demo-report.json"), `${JSON.stringify(before, null, 2)}\n`],
  [resolve(docs, "demo-report.md"), renderAuditMarkdown(before)],
  [resolve(docs, "demo-diff.html"), renderDiffHtml(comparison)],
  [resolve(docs, "demo-diff.md"), renderDiffMarkdown(comparison)],
  [resolve(examples, "repair-overlay.ics"), overlay.ics],
]);

const check = process.argv.includes("--check");
const mismatches = [];
for (const [path, content] of outputs) {
  if (check) {
    let existing = "";
    try {
      existing = await readFile(path, "utf8");
    } catch {
      mismatches.push(`${path} is missing`);
      continue;
    }
    if (existing !== content)
      mismatches.push(`${path} is stale; run npm run demo`);
  } else {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
  }
}
if (mismatches.length) {
  process.stderr.write(`${mismatches.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `${check ? "Verified" : "Generated"} ${outputs.size} deterministic demo artifacts.\n`,
  );
}
