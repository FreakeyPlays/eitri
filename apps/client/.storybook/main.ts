import type { StorybookConfig } from "@storybook/angular-vite";
import { defineStorybookVis } from "storybook-addon-vis/node";

const config: StorybookConfig = {
  stories: ["../projects/**/*.mdx", "../projects/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    defineStorybookVis({
      visProjects: [
        {
          snapshotRootDir: ({ platform }) => `${import.meta.dirname}/__vis__/${platform}`,
          snapshotSubpath: ({ subpath }) => subpath.replace(/^.*\/src\//, ""),
        },
      ],
    }),
  ],
  framework: "@storybook/angular-vite",
  features: {
    menuOnboardingChecklist: false,
    sidebarOnboardingChecklist: false,
  },
};
export default config;
