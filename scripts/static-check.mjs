import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const excluded = new Set([
  ".git",
  "node_modules",
  "dist",
  "dist-standalone",
  "release",
]);
const textExtensions = new Set([
  ".ts",
  ".mjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".html",
  ".css",
]);

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(path)));
    else if (textExtensions.has(extname(entry.name))) output.push(path);
  }
  return output;
}

const failures = [];
const files = await walk(root);
const checkerPath = resolve(root, "scripts", "static-check.mjs");
for (const path of files) {
  if (path === checkerPath) continue;
  const content = await readFile(path, "utf8");
  const display = relative(root, path).replaceAll("\\", "/");
  if (/\b(?:TODO|FIXME|HACK)\b/.test(content))
    failures.push(`${display}: contains an unfinished-work marker`);
  if (/Co-authored-by:/i.test(content))
    failures.push(`${display}: contains a Co-authored-by trailer`);
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content))
    failures.push(`${display}: contains a private-key marker`);
  if (/gh[oprsu]_[A-Za-z0-9]{20,}/.test(content))
    failures.push(`${display}: contains a GitHub-token-shaped value`);
}

const packageJson = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8"),
);
const cli = await readFile(resolve(root, "src", "cli.ts"), "utf8");
const analyze = await readFile(resolve(root, "src", "analyze.ts"), "utf8");
for (const [name, content] of [
  ["src/cli.ts", cli],
  ["src/analyze.ts", analyze],
]) {
  if (!content.includes(`const VERSION = "${packageJson.version}"`))
    failures.push(`${name}: version does not match package.json`);
}
if (
  /\bfetch\s*\(/.test(
    (
      await Promise.all(
        files
          .filter((path) => path.includes(`${resolve(root, "src")}`))
          .map((path) => readFile(path, "utf8")),
      )
    ).join("\n"),
  )
) {
  failures.push(
    "src: network fetch found; the v0.1 local-only boundary forbids network calls",
  );
}

if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Static check passed (${files.length} text files).\n`);
}
