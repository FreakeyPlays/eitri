import { defineConfig } from "vite-plus";

// Tests need Bun (`bun:sqlite`, Bun services), so the `test` script runs `bun --bun vp test`:
// `vp` hands its own runtime to Vitest, and plain `vp test` would start it under Node.
export default defineConfig({
  pack: {
    entry: ["src/bin.ts"],
    outDir: "dist",
    platform: "node",
    format: "esm",
    sourcemap: false,
    minify: true,
    clean: true,
    deps: {
      alwaysBundle: (id) => id !== "bun:sqlite",
      neverBundle: ["bun:sqlite"],
      onlyBundle: false,
    },
    banner: { js: "#!/usr/bin/env bun\n" },
  },
});
