import { HlmButton } from "@ui/button";
import { HlmInput } from "@ui/input";
import { HlmSheet, HlmSheetImports } from "@ui/sheet";
import { type Meta, type StoryObj, argsToTemplate, moduleMetadata } from "@storybook/angular-vite";

type SheetArgs = { side: "top" | "bottom" | "left" | "right" };

const meta: Meta<SheetArgs> = {
  title: "Sheet",
  component: HlmSheet,
  tags: ["autodocs"],
  args: { side: "left" },
  argTypes: {
    side: { control: "select", options: ["top", "bottom", "left", "right"] },
  },
  decorators: [
    moduleMetadata({
      imports: [HlmSheetImports, HlmButton, HlmInput],
    }),
  ],
};

export default meta;
type Story = StoryObj<SheetArgs>;

export const Default: Story = {
  render: ({ ...args }) => ({
    props: args,
    template: `
      <hlm-sheet ${argsToTemplate(args)}>
        <button id="edit-profile" variant="outline" hlmSheetTrigger hlmBtn>Edit Profile</button>
        <hlm-sheet-content *hlmSheetPortal="let ctx">
          <hlm-sheet-header>
            <h3 hlmSheetTitle>Edit Profile</h3>
            <p hlmSheetDescription>
              Make changes to your profile here. Click save when you're done.
            </p>
          </hlm-sheet-header>
          <div class="grid gap-4 px-4 py-4">
            <div class="grid grid-cols-4 items-center gap-4">
              <label for="name" class="text-right text-sm leading-none font-medium">Name</label>
              <input hlmInput id="name" value="Pedro Duarte" class="col-span-3" />
            </div>
            <div class="grid grid-cols-4 items-center gap-4">
              <label for="username" class="text-right text-sm leading-none font-medium">
                Username
              </label>
              <input hlmInput id="username" value="@peduarte" class="col-span-3" />
            </div>
          </div>
          <hlm-sheet-footer>
            <button hlmBtn type="submit">Save Changes</button>
          </hlm-sheet-footer>
        </hlm-sheet-content>
      </hlm-sheet>
    `,
  }),
};
