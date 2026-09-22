#!/usr/bin/env bun

import { readdir, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, sep } from "node:path";
import { DATA_DIR, DEV_DATA_DIR } from "../apps/server/src/data-dir.ts";

const args = new Set(Bun.argv.slice(2));
const unknown = [...args].filter((arg) => arg !== "--dry-run" && arg !== "-n");
if (unknown.length > 0) {
  console.error(`Unknown option: ${unknown.join(", ")}`);
  console.error("Usage: bun scripts/reset-dev-data.ts [--dry-run|-n]");
  process.exit(1);
}

const dryRun = args.has("--dry-run") || args.has("-n");
const home = homedir();
const target = join(home, DEV_DATA_DIR);

/**
 * The installed app's data lives one directory over and is never this script's
 * business. The compiler already proves the two constants differ; these guard
 * the paths they produce, so a later edit cannot widen this into a bigger delete.
 */
if (DEV_DATA_DIR.includes(sep) || DEV_DATA_DIR.startsWith("..")) {
  console.error(`Refusing to remove ${target}: that is not a single folder in your home.`);
  process.exit(1);
}
if (target === join(home, DATA_DIR) || target === home) {
  console.error(`Refusing to remove ${target}: that is the installed app's data.`);
  process.exit(1);
}

const directory = await stat(target).catch(() => null);
if (directory === null) {
  console.log(`Nothing to remove: ${target} does not exist.`);
  process.exit(0);
}
if (!directory.isDirectory()) {
  console.error(`Refusing to remove ${target}: it is not a directory.`);
  process.exit(1);
}

const entries = await readdir(target);
console.log(`${dryRun ? "Would remove" : "Removing"} ${target}`);
for (const entry of entries.sort()) console.log(`  ${entry}`);
if (entries.length === 0) console.log("  (empty)");

if (dryRun) {
  console.log("Dry run only; nothing was removed.");
  process.exit(0);
}

await rm(target, { recursive: true, force: true });
console.log("Development data removed. The backend recreates it on the next start.");
