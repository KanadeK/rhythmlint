import { chmod, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(root, "dist-standalone");
const output = resolve(outputDirectory, "rhythmlint.mjs");
await mkdir(outputDirectory, { recursive: true });
await build({
  entryPoints: [resolve(root, "src", "cli.ts")],
  outfile: output,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: false,
  minify: false,
  legalComments: "eof",
  banner: {
    js: "// RhythmLint is MIT licensed. This bundle includes ical.js 2.2.1 under MPL-2.0; see THIRD_PARTY_NOTICES.md.",
  },
});
if (process.platform !== "win32") await chmod(output, 0o755);
