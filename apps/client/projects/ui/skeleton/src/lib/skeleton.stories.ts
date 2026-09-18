import { HlmSkeleton } from "./hlm-skeleton";
import { type Meta, type StoryObj, moduleMetadata } from "@storybook/angular-vite";

const meta: Meta<HlmSkeleton> = {
  title: "Skeleton",
  component: HlmSkeleton,
  tags: ["autodocs"],
  decorators: [
    moduleMetadata({
      imports: [HlmSkeleton],
    }),
  ],
};

export default meta;
type Story = StoryObj<HlmSkeleton>;

export const Default: Story = {
  render: () => ({
    template: `
      <div class="border-border m-4 flex w-fit items-center space-x-4 rounded-lg border p-4">
        <hlm-skeleton class="h-12 w-12 rounded-full" />
        <div class="space-y-2">
          <hlm-skeleton class="h-4 w-62.5" />
          <hlm-skeleton class="h-4 w-50" />
        </div>
      </div>
    `,
  }),
};
