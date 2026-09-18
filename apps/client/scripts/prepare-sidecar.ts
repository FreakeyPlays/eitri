import { $ } from "bun";
import { chmod } from "node:fs/promises";
import {
  type ArchTriple,
  BUN_TARGETS,
  isSidecarTriple,
  SIDECAR_TRIPLES,
  type SidecarTriple,
  sidecarBinaryName,
  UNIVERSAL_SLICES,
  UNIVERSAL_TRIPLE,
} from "./lib/sidecar-targets.ts";

// The server bundle arrives through the task graph (@eitri/client#sidecar
// depends on @eitri/server#build), so this script only turns that bundle into
// the executable Tauri expects to find beside `externalBin`.
const bundle = `${import.meta.dir}/../../server/dist/bin.mjs`;
const destination = `${import.meta.dir}/../src-tauri/sidecar`;

const triple =
  Bun.env["TAURI_ENV_TARGET_TRIPLE"] ?? /^host: (.+)$/m.exec(await $`rustc -vV`.text())?.[1] ?? "";
if (!isSidecarTriple(triple)) {
  throw new Error(
    `Unsupported sidecar target: ${triple || "unknown"}. Supported: ${SIDECAR_TRIPLES.join(", ")}.`,
  );
}
if (triple === UNIVERSAL_TRIPLE && process.platform !== "darwin") {
  throw new Error("The universal macOS sidecar requires lipo, which only runs on macOS.");
}

const binary = (target: SidecarTriple) => `${destination}/${sidecarBinaryName(target)}`;

const compile = async (target: ArchTriple) => {
  await $`bun build --compile --minify --target=${BUN_TARGETS[target]} --outfile=${binary(target)} ${bundle}`;
  await chmod(binary(target), 0o755);
};

await $`mkdir -p ${destination}`;
if (triple === UNIVERSAL_TRIPLE) {
  for (const slice of UNIVERSAL_SLICES) await compile(slice);
  await $`lipo -create ${UNIVERSAL_SLICES.map(binary)} -output ${binary(triple)}`;
  await chmod(binary(triple), 0o755);
} else {
  await compile(triple);
}
console.log(`Prepared ${sidecarBinaryName(triple)} for ${triple}.`);
