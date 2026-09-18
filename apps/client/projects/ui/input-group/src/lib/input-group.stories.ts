import { NgIcon, provideIcons } from "@ng-icons/core";
import { lucideArrowUp, lucideCheck, lucideInfo, lucidePlus, lucideSearch } from "@ng-icons/lucide";
import { HlmInputGroup, HlmInputGroupImports } from "@ui/input-group";
import { HlmSeparator } from "@ui/separator";
import { HlmTooltip } from "@ui/tooltip";
import { type Meta, type StoryObj, moduleMetadata } from "@storybook/angular-vite";

const meta: Meta<HlmInputGroup> = {
  title: "Input Group",
  component: HlmInputGroup,
  tags: ["autodocs"],
  decorators: [
    moduleMetadata({
      imports: [HlmInputGroupImports, NgIcon, HlmSeparator, HlmTooltip],
      providers: [
        provideIcons({ lucideSearch, lucideInfo, lucidePlus, lucideArrowUp, lucideCheck }),
      ],
    }),
  ],
};

export default meta;
type Story = StoryObj<HlmInputGroup>;

export const Default: Story = {
  render: () => ({
    template: `
      <div class="grid w-full max-w-sm gap-6">
        <div hlmInputGroup>
          <input hlmInputGroupInput placeholder="Search..." />
          <div hlmInputGroupAddon>
            <ng-icon name="lucideSearch" />
          </div>
          <div hlmInputGroupAddon align="inline-end">12 results</div>
        </div>
        <div hlmInputGroup>
          <input hlmInputGroupInput placeholder="example.com" class="pl-1!" />
          <div hlmInputGroupAddon>
            <span hlmInputGroupText>https://</span>
          </div>
          <div hlmInputGroupAddon align="inline-end">
            <button
              hlmInputGroupButton
              class="rounded-full"
              size="icon-xs"
              [hlmTooltip]="'This is content in a tooltip.'"
            >
              <ng-icon name="lucideInfo" />
            </button>
          </div>
        </div>
        <div hlmInputGroup>
          <textarea hlmInputGroupTextarea placeholder="Ask, Search or Chat..."></textarea>
          <div hlmInputGroupAddon align="block-end">
            <button hlmInputGroupButton variant="outline" class="rounded-full" size="icon-xs">
              <ng-icon name="lucidePlus" />
            </button>
            <span hlmInputGroupText class="ml-auto">52% used</span>
            <hlm-separator orientation="vertical" class="h-4!" />
            <button hlmInputGroupButton variant="default" class="rounded-full" size="icon-xs" disabled>
              <ng-icon name="lucideArrowUp" />
              <span class="sr-only">Send</span>
            </button>
          </div>
        </div>
        <div hlmInputGroup>
          <input hlmInputGroupInput placeholder="@spartan" />
          <div hlmInputGroupAddon align="inline-end">
            <div class="bg-primary text-primary-foreground flex size-4 items-center justify-center rounded-full">
              <ng-icon name="lucideCheck" />
            </div>
          </div>
        </div>
      </div>
    `,
  }),
};
