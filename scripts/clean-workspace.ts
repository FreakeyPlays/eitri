#!/usr/bin/env bun

const args = new Set(Bun.argv.slice(2));

const unknown = [...args].filter((arg) => arg !== "--dry-run" && arg !== "-n");
if (unknown.length > 0) {
  console.error(`Unknown option!`);
  process.exit(1);
}

const dryRun = args.has("--dry-run") || args.has("-n");
const rootResult = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], {
  stderr: "inherit",
  stdout: "pipe",
});

if (!rootResult.success) {
  console.error("Unable to find the Git workspace root.");
  process.exit(rootResult.exitCode);
}

const workspaceRoot = rootResult.stdout.toString().trim();
const cleanArgs = ["git", "clean", dryRun ? "-ndX" : "-fdX"];

if (!dryRun) {
  console.log("Removing ignored, untracked files and directories...");
}

const cleanResult = Bun.spawnSync(cleanArgs, {
  cwd: workspaceRoot,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

if (!cleanResult.success) process.exit(cleanResult.exitCode);

if (dryRun) {
  console.log("Dry run only; nothing was removed.");
} else {
  console.log("Workspace cleaned. Run `vp install` to restore dependencies and git hooks.");
}
