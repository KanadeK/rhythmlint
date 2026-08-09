import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tests = (await readdir(resolve(root, "test")))
  .filter((name) => name.endsWith(".test.mjs"))
  .sort()
  .map((name) => resolve(root, "test", name));
if (tests.length === 0) throw new Error("No test files were found");

const coverage = process.argv.includes("--coverage");
const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
if (coverage && (major < 22 || (major === 22 && minor < 8))) {
  throw new Error(
    "Enforced coverage thresholds require Node 22.8 or newer; npm test supports Node 20+",
  );
}

const args = ["--test"];
if (coverage) {
  args.push(
    "--experimental-test-coverage",
    "--test-coverage-include=dist/**/*.js",
    "--test-coverage-exclude=dist/cli.js",
    "--test-coverage-lines=88",
    "--test-coverage-functions=88",
    "--test-coverage-branches=78",
  );
}
args.push(...tests);
const result = spawnSync(process.execPath, args, {
  cwd: root,
  stdio: "inherit",
});
process.exitCode = result.status ?? 1;
