import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCli = process.env.npm_execpath;
if (!npmCli)
  throw new Error(
    "npm_execpath is unavailable; run this script through npm run release:check",
  );

function npmRun(script) {
  const result = spawnSync(process.execPath, [npmCli, "run", script], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0)
    throw new Error(
      `${script} failed with exit code ${result.status ?? "unknown"}`,
    );
}

for (const script of [
  "format:check",
  "lint",
  "test:coverage",
  "demo:check",
  "package:release",
])
  npmRun(script);

const required = [
  "README.md",
  "README.zh-CN.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "docs/ARCHITECTURE.md",
  "docs/ACCEPTANCE.md",
  "docs/COMPETITOR_SCAN.md",
  "docs/PRIVACY.md",
  "docs/REPAIR_GUIDE.md",
  "docs/RULES.md",
  ".github/workflows/ci.yml",
  ".github/workflows/pages.yml",
  ".github/workflows/release.yml",
];
for (const path of required) await readFile(resolve(root, path), "utf8");
process.stdout.write("Release check passed.\n");
