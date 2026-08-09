import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const name of ["dist", "dist-standalone"]) {
  const target = resolve(root, name);
  if (dirname(target) !== root)
    throw new Error(`Refusing to clean unexpected path: ${target}`);
  await rm(target, { recursive: true, force: true });
}
