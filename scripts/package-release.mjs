import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const release = resolve(root, "release");
if (dirname(release) !== root)
  throw new Error(`Refusing to replace unexpected release path: ${release}`);
await rm(release, { recursive: true, force: true });
await mkdir(release, { recursive: true });

const npmCli = process.env.npm_execpath;
if (!npmCli)
  throw new Error(
    "npm_execpath is unavailable; run this script through npm run package:release",
  );
const packed = spawnSync(
  process.execPath,
  [npmCli, "pack", "--pack-destination", release],
  {
    cwd: root,
    stdio: "inherit",
  },
);
if (packed.status !== 0)
  throw new Error(
    `npm pack failed with exit code ${packed.status ?? "unknown"}`,
  );

const packageJson = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8"),
);
await copyFile(
  resolve(root, "dist-standalone", "rhythmlint.mjs"),
  resolve(release, `rhythmlint-${packageJson.version}-standalone.mjs`),
);
await copyFile(
  resolve(root, "docs", "index.html"),
  resolve(release, `rhythmlint-${packageJson.version}-demo-report.html`),
);
await copyFile(
  resolve(root, "examples", "repair-overlay.ics"),
  resolve(release, `rhythmlint-${packageJson.version}-repair-overlay.ics`),
);
await copyFile(
  resolve(root, "THIRD_PARTY_NOTICES.md"),
  resolve(release, "THIRD_PARTY_NOTICES.md"),
);

async function digest(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

const preliminary = (await readdir(release)).sort();
const artifacts = [];
for (const name of preliminary) {
  const path = resolve(release, name);
  artifacts.push({
    name,
    bytes: (await stat(path)).size,
    sha256: await digest(path),
  });
}
const manifest = {
  schemaVersion: "rhythmlint.release.v1",
  name: packageJson.name,
  version: packageJson.version,
  node: packageJson.engines.node,
  artifacts,
};
await writeFile(
  resolve(release, "release-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

const finalNames = (await readdir(release))
  .filter((name) => name !== "SHA256SUMS.txt")
  .sort();
const sums = [];
for (const name of finalNames)
  sums.push(`${await digest(resolve(release, name))}  ${name}`);
await writeFile(
  resolve(release, "SHA256SUMS.txt"),
  `${sums.join("\n")}\n`,
  "utf8",
);
process.stdout.write(
  `Packaged ${finalNames.length + 1} release files in ${relative(process.cwd(), release) || release}.\n`,
);
