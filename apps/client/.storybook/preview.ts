import { definePreview } from "@storybook/angular-vite";
import addonA11y from "@storybook/addon-a11y";
import addonDocs from "@storybook/addon-docs";
import addonVis from "storybook-addon-vis";
import "../projects/desktop/src/styles.css";

const preview = definePreview({
  addons: [addonDocs(), addonA11y(), addonVis({ auto: true })],
  tags: ["autodocs"],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
  },
});

export default preview;
