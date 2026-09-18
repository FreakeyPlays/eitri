import { FormsModule } from "@angular/forms";
import { HlmButton } from "@ui/button";
import { HlmTextarea } from "./hlm-textarea";
import { type Meta, type StoryObj, argsToTemplate, moduleMetadata } from "@storybook/angular-vite";

type TextareaArgs = { forceInvalid: boolean };

const meta: Meta<TextareaArgs> = {
  title: "Textarea",
  component: HlmTextarea,
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
      imports: [HlmTextarea, HlmButton, FormsModule],
    }),
  ],
};

export default meta;
type Story = StoryObj<TextareaArgs>;

export const Default: Story = {
  render: ({ ...args }) => ({
    props: args,
    template: `
      <textarea hlmTextarea class="w-80" placeholder="Type your message here." ${argsToTemplate(args)}></textarea>
    `,
  }),
};

export const Disabled: Story = {
  render: ({ ...args }) => ({
    props: args,
    template: `
      <textarea hlmTextarea disabled class="w-80" placeholder="Type your message here." ${argsToTemplate(args)}></textarea>
    `,
  }),
};

export const Required: Story = {
  render: ({ ...args }) => ({
    props: { value: "", ...args },
    template: `
      <textarea hlmTextarea required [(ngModel)]="value" class="w-80" placeholder="Type your message here.*" ${argsToTemplate(args)}></textarea>
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
      <textarea hlmTextarea class="w-80" placeholder="Type your message here.*" ${argsToTemplate(args)}></textarea>
    `,
  }),
};

export const WithButton: Story = {
  name: "With Button",
  render: ({ ...args }) => ({
    props: args,
    template: `
      <div class="grid w-80 gap-2">
        <textarea hlmTextarea placeholder="Type your message here." ${argsToTemplate(args)}></textarea>
        <button hlmBtn>Subscribe</button>
      </div>
    `,
  }),
};
