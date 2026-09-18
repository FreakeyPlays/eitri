import { FormsModule } from "@angular/forms";
import { HlmButton } from "@ui/button";
import { HlmInput } from "./hlm-input";
import { type Meta, type StoryObj, argsToTemplate, moduleMetadata } from "@storybook/angular-vite";

type InputArgs = { forceInvalid: boolean };

const meta: Meta<InputArgs> = {
  title: "Input",
  component: HlmInput,
  tags: ["autodocs"],
  args: {
    forceInvalid: false,
  },
  argTypes: {
    forceInvalid: {
      control: { type: "boolean" },
    },
  },
  decorators: [
    moduleMetadata({
      imports: [HlmInput, HlmButton, FormsModule],
    }),
  ],
};

export default meta;
type Story = StoryObj<InputArgs>;

export const Default: Story = {
  render: ({ ...args }) => ({
    props: args,
    template: `
      <input aria-label="Email" class="w-80" hlmInput ${argsToTemplate(args)} type="email" placeholder="Email" />
    `,
  }),
};

export const File: Story = {
  render: ({ ...args }) => ({
    props: args,
    template: `
      <div class="grid w-full max-w-sm items-center gap-1.5">
        <label for="picture" class="text-sm leading-none font-medium">Picture</label>
        <input class="w-80" hlmInput ${argsToTemplate(args)} id="picture" type="file" />
      </div>
    `,
  }),
};

export const Disabled: Story = {
  render: ({ ...args }) => ({
    props: args,
    template: `
      <input aria-label="Email" disabled class="w-80" hlmInput ${argsToTemplate(args)} type="email" placeholder="Email" />
    `,
  }),
};

export const Required: Story = {
  render: ({ ...args }) => ({
    props: { value: "", ...args },
    template: `
      <input aria-label="Email *" [(ngModel)]="value" class="w-80" hlmInput ${argsToTemplate(args)} type="email" required placeholder="Email *" />
    `,
  }),
};

export const Error: Story = {
  args: {
    forceInvalid: true,
  },
  render: ({ ...args }) => ({
    props: args,
    template: `
      <input aria-label="Email" class="w-80" hlmInput ${argsToTemplate(args)} type="email" placeholder="Email" />
    `,
  }),
};

export const WithButton: Story = {
  name: "With Button",
  render: ({ ...args }) => ({
    props: args,
    template: `
      <div class="flex w-full max-w-sm items-center space-x-2">
        <input aria-label="Email" class="w-80" hlmInput ${argsToTemplate(args)} type="email" placeholder="Email" />
        <button hlmBtn>Subscribe</button>
      </div>
    `,
  }),
};
