import { defineConfig, mergeConfig } from "vite-plus";
import baseConfig from "../../vite.config.ts";

export default mergeConfig(
  baseConfig,
  defineConfig({
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
  }),
);
