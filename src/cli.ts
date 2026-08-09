#!/usr/bin/env node

import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { constants } from "node:fs";
import { pathToFileURL } from "node:url";

import { analyzeParsed } from "./analyze.js";
import {
  loadConfig,
  resolveAuditWindow,
  serializableDefaultConfig,
} from "./config.js";
import { diffReports } from "./diff.js";
import { parseCalendarFiles } from "./ics.js";
import { generateOverlay } from "./overlay.js";
import { renderAudit, renderDiff, type OutputFormat } from "./reporters.js";
import { RULES } from "./rules.js";
import type { AuditReport, RhythmLintConfig } from "./types.js";

const VERSION = "0.1.0";
const VALUE_OPTIONS = new Set([
  "config",
  "from",
  "days",
  "format",
  "out",
  "fail-on",
]);
const BOOLEAN_OPTIONS = new Set([
  "help",
  "version",
  "redact",
  "redact-locations",
  "no-lunch",
  "force",
]);

interface ParsedArgs {
  positionals: string[];
  options: Map<string, string | boolean>;
}

function parseArgs(args: string[]): ParsedArgs {
  const positionals: string[] = [];
  const options = new Map<string, string | boolean>();
  let positionalOnly = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) continue;
    if (positionalOnly || !arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    if (arg === "--") {
      positionalOnly = true;
      continue;
    }
    const equal = arg.indexOf("=");
    const name = arg.slice(2, equal === -1 ? undefined : equal);
    if (BOOLEAN_OPTIONS.has(name)) {
      if (equal !== -1) throw new Error(`--${name} does not accept a value`);
      options.set(name, true);
      continue;
    }
    if (!VALUE_OPTIONS.has(name)) throw new Error(`Unknown option: --${name}`);
    const value = equal === -1 ? args[index + 1] : arg.slice(equal + 1);
    if (!value || value.startsWith("--"))
      throw new Error(`--${name} requires a value`);
    if (equal === -1) index += 1;
    options.set(name, value);
  }
  return { positionals, options };
}

function stringOption(args: ParsedArgs, name: string): string | undefined {
  const value = args.options.get(name);
  return typeof value === "string" ? value : undefined;
}

function booleanOption(args: ParsedArgs, name: string): boolean {
  return args.options.get(name) === true;
}

function numberOption(
  args: ParsedArgs,
  name: string,
  fallback: number,
): number {
  const value = stringOption(args, name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed))
    throw new Error(`--${name} must be an integer`);
  return parsed;
}

function outputFormat(args: ParsedArgs): OutputFormat {
  const value = stringOption(args, "format") ?? "console";
  if (
    value !== "console" &&
    value !== "json" &&
    value !== "markdown" &&
    value !== "html"
  ) {
    throw new Error("--format must be console, json, markdown, or html");
  }
  return value;
}

function failOn(args: ParsedArgs): "error" | "warning" | "none" {
  const value = stringOption(args, "fail-on") ?? "error";
  if (value !== "error" && value !== "warning" && value !== "none") {
    throw new Error("--fail-on must be error, warning, or none");
  }
  return value;
}

function exitForReport(
  report: AuditReport,
  threshold: "error" | "warning" | "none",
): number {
  if (threshold === "none") return 0;
  if (report.summary.errors > 0) return 1;
  return threshold === "warning" && report.summary.warnings > 0 ? 1 : 0;
}

function withPrivacy(
  config: RhythmLintConfig,
  args: ParsedArgs,
): RhythmLintConfig {
  const updated = structuredClone(config);
  if (booleanOption(args, "redact")) updated.privacy.redactTitles = true;
  if (booleanOption(args, "redact-locations"))
    updated.privacy.redactLocations = true;
  return updated;
}

async function writeResult(content: string, path?: string): Promise<void> {
  if (!path) {
    process.stdout.write(content);
    return;
  }
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, content, "utf8");
  process.stderr.write(`Wrote ${absolute}\n`);
}

async function auditFiles(
  paths: string[],
  args: ParsedArgs,
): Promise<AuditReport> {
  const config = withPrivacy(
    await loadConfig(stringOption(args, "config")),
    args,
  );
  const window = resolveAuditWindow(
    config,
    stringOption(args, "from"),
    numberOption(args, "days", 7),
  );
  const parsed = await parseCalendarFiles(paths, window, config);
  return analyzeParsed(parsed, window, config, VERSION);
}

async function auditCommand(args: ParsedArgs): Promise<number> {
  if (args.positionals.length === 0)
    throw new Error("audit requires at least one ICS file");
  const report = await auditFiles(args.positionals, args);
  await writeResult(
    renderAudit(report, outputFormat(args)),
    stringOption(args, "out"),
  );
  return exitForReport(report, failOn(args));
}

async function diffCommand(args: ParsedArgs): Promise<number> {
  if (args.positionals.length !== 2)
    throw new Error("diff requires exactly two ICS files: before and after");
  const beforePath = args.positionals[0];
  const afterPath = args.positionals[1];
  if (!beforePath || !afterPath)
    throw new Error("diff requires before and after paths");
  const before = await auditFiles([beforePath], args);
  const after = await auditFiles([afterPath], args);
  const report = diffReports(before, after);
  await writeResult(
    renderDiff(report, outputFormat(args)),
    stringOption(args, "out"),
  );
  return exitForReport(after, failOn(args));
}

async function overlayCommand(args: ParsedArgs): Promise<number> {
  if (args.positionals.length === 0)
    throw new Error("overlay requires at least one ICS file");
  const out = stringOption(args, "out");
  if (!out) throw new Error("overlay requires --out <repair.ics>");
  const config = withPrivacy(
    await loadConfig(stringOption(args, "config")),
    args,
  );
  const window = resolveAuditWindow(
    config,
    stringOption(args, "from"),
    numberOption(args, "days", 7),
  );
  const parsed = await parseCalendarFiles(args.positionals, window, config);
  const result = generateOverlay(
    parsed.events,
    window,
    config,
    !booleanOption(args, "no-lunch"),
  );
  await writeResult(result.ics, out);
  process.stderr.write(
    `Generated ${result.holds.length} tentative hold(s); ${result.unresolvedFocusBlocks} focus block(s) still require rescheduling.\n`,
  );
  return result.unresolvedFocusBlocks > 0 ? 1 : 0;
}

async function initCommand(args: ParsedArgs): Promise<number> {
  if (args.positionals.length > 0) throw new Error("init accepts options only");
  const path = resolve(stringOption(args, "out") ?? "rhythmlint.config.json");
  if (!booleanOption(args, "force")) {
    try {
      await access(path, constants.F_OK);
      throw new Error(`${path} already exists; pass --force to replace it`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists"))
        throw error;
      if (
        !(
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ENOENT"
        )
      )
        throw error;
    }
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify(serializableDefaultConfig(), null, 2)}\n`,
    "utf8",
  );
  process.stderr.write(`Wrote ${path}\n`);
  return 0;
}

function rulesCommand(args: ParsedArgs): number {
  if (args.positionals.length > 0)
    throw new Error("rules accepts options only");
  const format = outputFormat(args);
  if (format === "json") {
    process.stdout.write(`${JSON.stringify(RULES, null, 2)}\n`);
    return 0;
  }
  if (format === "html")
    throw new Error("rules supports console, json, or markdown output");
  if (format === "markdown") {
    process.stdout.write(
      `# RhythmLint rules\n\n| ID | Name | Default | Description |\n|---|---|---|---|\n${RULES.map((rule) => `| ${rule.id} | ${rule.name} | ${rule.defaultSeverity} | ${rule.description} |`).join("\n")}\n`,
    );
    return 0;
  }
  process.stdout.write(
    `${RULES.map((rule) => `${rule.id}  ${rule.name.padEnd(28)} ${rule.defaultSeverity.padEnd(7)} ${rule.description}`).join("\n")}\n`,
  );
  return 0;
}

function help(): string {
  return `RhythmLint ${VERSION} — policy-as-code for calendar health

Usage:
  rhythmlint audit <calendar.ics...> [options]
  rhythmlint diff <before.ics> <after.ics> [options]
  rhythmlint overlay <calendar.ics...> --out repair.ics [options]
  rhythmlint init [--out rhythmlint.config.json] [--force]
  rhythmlint rules [--format console|json|markdown]

Common options:
  --config <path>          JSON policy file (defaults are used when omitted)
  --from <YYYY-MM-DD>      First local date to audit (default: today)
  --days <1..366>          Audit-window length (default: 7)
  --format <format>        console, json, markdown, or html
  --out <path>             Write the report instead of stdout
  --fail-on <threshold>    error, warning, or none (default: error)
  --redact                 Replace event titles with stable local labels
  --redact-locations       Remove locations from report event data
  --no-lunch               Overlay: omit proactive lunch holds
  --help                   Show this help
  --version                Show the version

Exit codes:
  0  Command completed and the selected policy threshold passed
  1  Policy threshold failed, or overlay could not reserve every required block
  2  Invalid arguments, unreadable input, malformed config, or parser failure
`;
}

export async function runCli(argv = process.argv.slice(2)): Promise<number> {
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help") {
    process.stdout.write(help());
    return 0;
  }
  if (command === "--version" || command === "version") {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  const args = parseArgs(rest);
  if (booleanOption(args, "help")) {
    process.stdout.write(help());
    return 0;
  }
  if (booleanOption(args, "version")) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  switch (command) {
    case "audit":
      return auditCommand(args);
    case "diff":
      return diffCommand(args);
    case "overlay":
      return overlayCommand(args);
    case "init":
      return initCommand(args);
    case "rules":
      return rulesCommand(args);
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

async function main(): Promise<void> {
  try {
    process.exitCode = await runCli();
  } catch (error) {
    process.stderr.write(
      `RhythmLint: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
