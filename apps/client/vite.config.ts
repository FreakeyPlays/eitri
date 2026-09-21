/// <reference types="vitest/config" />
import angular from "@analogjs/vite-plugin-angular";
import { defineConfig, mergeConfig } from "vite-plus";
import baseConfig from "../../vite.config.ts";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "vite-plus/test/browser-playwright";
import { storybookAngularVitest } from "@storybook/angular-vite/vitest";
import { storybookVis } from "storybook-addon-vis/vitest-plugin";

export default mergeConfig(
  baseConfig,
  defineConfig({
    // Stryker loads this config from the workspace root.
    root: import.meta.dirname,
    run: {
      tasks: {
        sidecar: {
          command: "bun scripts/prepare-sidecar.ts",
          dependsOn: ["@eitri/server#build"],
          env: ["TAURI_ENV_TARGET_TRIPLE"],
          // Bun reads the staging script through its own loader, which file
          // tracking misses, so a changed staging layout would replay a stale
          // sidecar from the cache instead of being rebuilt.
          input: [{ auto: true }, "scripts/**"],
          output: ["src-tauri/sidecar/**"],
        },
        "tauri:check": {
          command: "vp run tauri:fmt && vp run tauri:lint && vp run tauri:test",
          dependsOn: ["@eitri/client#sidecar"],
          cache: false,
        },
      },
    },
    test: {
      projects: [
        {
          extends: true,
          plugins: [
            angular({ tsconfig: `${import.meta.dirname}/projects/desktop/tsconfig.spec.json` }),
          ],
          resolve: { tsconfigPaths: true },
          test: {
            name: "unit",
            globals: true,
            environment: "jsdom",
            setupFiles: ["projects/desktop/src/test-setup.ts"],
            include: ["projects/desktop/src/**/*.spec.ts"],
          },
        },
        {
          extends: true,
          plugins: [
            storybookAngularVitest(),
            storybookTest({
              configDir: `${import.meta.dirname}/.storybook`,
            }),
            storybookVis({
              snapshotRootDir: ({ platform }) =>
                `${import.meta.dirname}/.storybook/__vis__/${platform}`,
              failureThresholdType: "pixel",
              failureThreshold: 100,
            }),
          ],
          test: {
            name: "storybook",
            browser: {
              enabled: true,
              headless: true,
              provider: playwright(),
              instances: [
                {
                  browser: "chromium",
                },
              ],
            },
          },
        },
      ],
    },
  }),
);
