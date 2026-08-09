import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { examples, root } from "./helpers.mjs";

const cli = resolve(root, "dist", "cli.js");
const standalone = resolve(root, "dist-standalone", "rhythmlint.mjs");
const config = resolve(examples, "rhythmlint.config.json");
const before = resolve(examples, "before.ics");

function run(entry, args) {
  return spawnSync(process.execPath, [entry, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

test("CLI exposes version, help, and rule catalog", () => {
  assert.equal(run(cli, ["--version"]).stdout.trim(), "0.1.0");
  assert.match(
    run(cli, ["--help"]).stdout,
    /policy-as-code for calendar health/,
  );
  const rules = run(cli, ["rules", "--format", "json"]);
  assert.equal(rules.status, 0);
  assert.equal(JSON.parse(rules.stdout).length, 9);
  assert.equal(run(standalone, ["--version"]).stdout.trim(), "0.1.0");
});

test("CLI audit honors threshold and JSON/redaction options", () => {
  const failed = run(cli, [
    "audit",
    before,
    "--config",
    config,
    "--from",
    "2026-08-03",
  ]);
  assert.equal(failed.status, 1);
  const passed = run(cli, [
    "audit",
    before,
    "--config",
    config,
    "--from",
    "2026-08-03",
    "--format",
    "json",
    "--redact",
    "--fail-on",
    "none",
  ]);
  assert.equal(passed.status, 0);
  const report = JSON.parse(passed.stdout);
  assert.equal(report.schemaVersion, "rhythmlint.audit.v1");
  assert.ok(!passed.stdout.includes("Daily Standup"));
});

test("CLI writes reports, config, and overlay with overwrite protection", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "rhythmlint-test-"));
  try {
    const reportPath = join(temporary, "report.html");
    const report = run(cli, [
      "audit",
      before,
      "--config",
      config,
      "--from",
      "2026-08-03",
      "--format",
      "html",
      "--out",
      reportPath,
      "--fail-on",
      "none",
    ]);
    assert.equal(report.status, 0);
    assert.match(await readFile(reportPath, "utf8"), /<!doctype html>/);

    const configPath = join(temporary, "policy.json");
    assert.equal(run(cli, ["init", "--out", configPath]).status, 0);
    assert.equal(run(cli, ["init", "--out", configPath]).status, 2);
    assert.equal(run(cli, ["init", "--out", configPath, "--force"]).status, 0);

    const overlayPath = join(temporary, "repair.ics");
    const overlay = run(cli, [
      "overlay",
      before,
      "--config",
      config,
      "--from",
      "2026-08-03",
      "--out",
      overlayPath,
    ]);
    assert.ok(overlay.status === 0 || overlay.status === 1);
    assert.match(await readFile(overlayPath, "utf8"), /BEGIN:VCALENDAR/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("CLI rejects invalid command and options with operational exit 2", () => {
  const unknown = run(cli, ["unknown"]);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /Unknown command/);
  assert.equal(run(cli, ["audit"]).status, 2);
  assert.equal(run(cli, ["audit", before, "--format", "xml"]).status, 2);
  assert.equal(run(cli, ["diff", before]).status, 2);
});
