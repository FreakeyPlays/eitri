import { HlmSeparator } from "./hlm-separator";
import { type Meta, type StoryObj, argsToTemplate, moduleMetadata } from "@storybook/angular-vite";

type SeparatorArgs = { orientation: "horizontal" | "vertical"; decorative: boolean };

const meta: Meta<SeparatorArgs> = {
  title: "Separator",
  component: HlmSeparator,
  tags: ["autodocs"],
  args: {
    orientation: "horizontal",
    decorative: false,
  },
  argTypes: {
    orientation: {
      options: ["horizontal", "vertical"],
      control: {
        type: "select",
      },
      table: {
        defaultValue: { summary: "horizontal" },
      },
    },
    decorative: {
      control: {
        type: "boolean",
      },
      table: {
        defaultValue: { summary: "false" },
      },
    },
  },
  decorators: [
    moduleMetadata({
      imports: [HlmSeparator],
    }),
  ],
};

export default meta;
type Story = StoryObj<SeparatorArgs>;

export const Default: Story = {
  render: ({ ...args }) => ({
    props: args,
    template: `
      <div>
        <div class="space-y-1">
          <h4 class="text-sm leading-none font-medium">Radix Primitives</h4>
          <p class="text-muted-foreground text-sm">An open-source UI component library.</p>
        </div>
        <hlm-separator ${argsToTemplate(args)} class="my-4" />
        <div class="flex h-5 items-center space-x-4 text-sm">
          <div>Blog</div>
          <hlm-separator decorative orientation="vertical" />
          <div>Docs</div>
          <hlm-separator decorative orientation="vertical" />
          <div>Source</div>
        </div>
      </div>
    `,
  }),
};
