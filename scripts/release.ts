#!/usr/bin/env bun
import { $ } from "bun";

const BUMPS = { feat: "minor", fix: "patch", perf: "patch" } as const;
const TYPES = new Set([
  "build",
  "chore",
  "ci",
  "docs",
  "feat",
  "fix",
  "perf",
  "refactor",
  "revert",
  "style",
  "test",
]);
const RANK = { patch: 0, minor: 1, major: 2 } as const;
type Bump = keyof typeof RANK;

const HEADER = /^[*-]?\s*([a-z]+)(?:\([^)]*\))?(!)?:\s/;

async function pending(current: string): Promise<{ bump: Bump | null; range: string }> {
  const tag = `v${current}`;
  const tagged =
    (await $`git rev-parse -q --verify refs/tags/${tag}`.nothrow().quiet()).exitCode === 0;
  const range = tagged ? `${tag}..HEAD` : "HEAD";
  const log = await $`git log ${range} --format=%B%x00`.quiet().text();

  let bump: Bump | null = null;
  const raise = (next: Bump) => {
    if (bump === null || RANK[next] > RANK[bump]) bump = next;
  };

  for (const message of log.split("\0")) {
    if (/^BREAKING[ -]CHANGE:/m.test(message)) raise("major");
    for (const line of message.split("\n")) {
      const match = HEADER.exec(line.trim());
      if (!match) continue;
      const [, type, breaking] = match;
      if (!TYPES.has(type!)) continue;
      if (breaking) raise("major");
      else if (type! in BUMPS) raise(BUMPS[type as keyof typeof BUMPS]);
    }
  }
  return { bump, range };
}

function bumped(version: string, bump: Bump) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error(`Cannot bump unsupported version "${version}"`);
  }
  const [major, minor, patch] = version.split(".").map(Number);
  if (bump === "major") return `${major! + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor! + 1}.0`;
  return `${major}.${minor}.${patch! + 1}`;
}

const [command, flag, ...extra] = process.argv.slice(2);

if (command !== "version" || (flag !== undefined && flag !== "--dry") || extra.length > 0) {
  console.error("usage: bun scripts/release.ts version [--dry]");
  process.exit(1);
}

const manifest = (await Bun.file("package.json").json()) as { version: string };
const current = manifest.version;
const { bump, range } = await pending(current);

if (bump === null) {
  console.log(`No releasable commits in ${range}`);
} else {
  const next = bumped(current, bump);
  if (flag === "--dry") {
    console.log(`Pending release: ${current} → ${next} (${bump} from ${range})`);
  } else {
    manifest.version = next;
    await Bun.write("package.json", `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Bumped ${current} → ${next} in package.json (${bump} from ${range})`);
  }
}
