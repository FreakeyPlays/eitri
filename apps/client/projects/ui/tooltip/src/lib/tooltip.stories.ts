import { Component, signal } from "@angular/core";
import { NgIcon, provideIcons } from "@ng-icons/core";
import { lucidePlus } from "@ng-icons/lucide";
import { HlmButton } from "@ui/button";
import { HlmTooltip } from "./hlm-tooltip";
import { type Meta, type StoryObj, argsToTemplate, moduleMetadata } from "@storybook/angular-vite";

type TooltipArgs = { position: "top" | "left" | "right" | "bottom" };

const meta: Meta<TooltipArgs> = {
  title: "Tooltip",
  component: HlmTooltip,
  tags: ["autodocs"],
  decorators: [
    moduleMetadata({
      imports: [HlmButton, HlmTooltip, NgIcon],
      providers: [provideIcons({ lucidePlus })],
    }),
  ],
};

export default meta;
type Story = StoryObj<TooltipArgs>;

export const Default: Story = {
  args: {
    position: "top",
  },
  argTypes: {
    position: {
      control: { type: "radio" },
      options: ["top", "left", "right", "bottom"],
    },
  },
  render: ({ ...args }) => ({
    props: args,
    template: `
      <div class="p-40">
        <button [hlmTooltip]="tooltip" ${argsToTemplate(args)} hlmBtn variant="outline">Test</button>
        <ng-template #tooltip>
          <span class="flex items-center">
            Add to library <ng-icon class="ml-2" name="lucidePlus" />
          </span>
        </ng-template>
      </div>
    `,
  }),
};

@Component({
  selector: "hlm-simple-tooltip-story",
  imports: [HlmButton, HlmTooltip, NgIcon],
  providers: [provideIcons({ lucidePlus })],
  template: `
    <div class="p-40">
      <button
        (click)="disabled.set(!disabled())"
        [hlmTooltip]="'Add to library'"
        [tooltipDisabled]="disabled()"
        hlmBtn
        size="icon"
        aria-label="Add to library"
      >
        <ng-icon name="lucidePlus" />
      </button>
    </div>
  `,
})
class SimpleTooltip {
  protected readonly disabled = signal(false);
}

export const Simple: Story = {
  decorators: [
    moduleMetadata({
      imports: [SimpleTooltip],
    }),
  ],
  render: () => ({
    template: "<hlm-simple-tooltip-story />",
  }),
};

@Component({
  selector: "hlm-disabled-tooltip-story",
  imports: [HlmButton, HlmTooltip, NgIcon],
  providers: [provideIcons({ lucidePlus })],
  template: `
    <div class="p-40">
      <button
        (click)="disabled.set(!disabled())"
        [hlmTooltip]="tooltip"
        [tooltipDisabled]="disabled()"
        hlmBtn
        variant="outline"
      >
        Test
      </button>
      <ng-template #tooltip>
        <span class="flex items-center">
          Add to library
          <ng-icon class="ml-2" name="lucidePlus" />
        </span>
      </ng-template>

      <p>{{ disabled() ? "disabled" : "enabled" }}</p>
    </div>
  `,
})
class DisabledTooltip {
  protected readonly disabled = signal(false);
}

export const Disabled: Story = {
  decorators: [
    moduleMetadata({
      imports: [DisabledTooltip],
    }),
  ],
  render: () => ({
    template: "<hlm-disabled-tooltip-story />",
  }),
};
