/**
 * The single source of truth for the desktop sidecar's build targets.
 *
 * Two consumers derive from this table, and they must never disagree:
 *
 * - `apps/client/scripts/prepare-sidecar.ts` compiles and stages the binary.
 * - `apps/client/src-tauri/tauri.conf.json` declares `externalBin`, and Tauri
 *   resolves it by appending the Rust target triple to `sidecar/eitri-server`.
 */
const SIDECAR_BASE_NAME = "eitri-server";

/** Rust target triple to the Bun compile target its binary is built from. */
export const BUN_TARGETS = {
  "aarch64-apple-darwin": "bun-darwin-arm64",
  "x86_64-apple-darwin": "bun-darwin-x64",
  "aarch64-unknown-linux-gnu": "bun-linux-arm64",
  "x86_64-unknown-linux-gnu": "bun-linux-x64",
  "aarch64-pc-windows-msvc": "bun-windows-arm64",
  "x86_64-pc-windows-msvc": "bun-windows-x64",
} as const satisfies Record<string, string>;

export type ArchTriple = keyof typeof BUN_TARGETS;

/**
 * Tauri builds the universal macOS app once per architecture, and each of those
 * builds checks for its own `externalBin`, so both slices keep their triple
 * names beside the `lipo`-joined universal binary.
 */
export const UNIVERSAL_TRIPLE = "universal-apple-darwin";
export const UNIVERSAL_SLICES = [
  "aarch64-apple-darwin",
  "x86_64-apple-darwin",
] as const satisfies readonly ArchTriple[];

export type SidecarTriple = ArchTriple | typeof UNIVERSAL_TRIPLE;

export const SIDECAR_TRIPLES: SidecarTriple[] = [
  ...(Object.keys(BUN_TARGETS) as ArchTriple[]),
  UNIVERSAL_TRIPLE,
];

export const isSidecarTriple = (triple: string): triple is SidecarTriple =>
  triple === UNIVERSAL_TRIPLE || triple in BUN_TARGETS;

/** Tauri strips the triple back off, so this must match `externalBin` exactly. */
export const sidecarBinaryName = (triple: SidecarTriple): string =>
  `${SIDECAR_BASE_NAME}-${triple}${triple.includes("windows") ? ".exe" : ""}`;
