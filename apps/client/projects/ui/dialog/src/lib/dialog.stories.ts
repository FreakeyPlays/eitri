import { Component, inject } from "@angular/core";
import {
  BrnDialogRef,
  injectBrnDialogContext,
  provideBrnDialogDefaultOptions,
} from "@spartan-ng/brain/dialog";
import { HlmButton } from "@ui/button";
import { HlmDialog, HlmDialogImports, HlmDialogService } from "@ui/dialog";
import { HlmInput } from "@ui/input";
import {
  type Meta,
  type StoryObj,
  applicationConfig,
  moduleMetadata,
} from "@storybook/angular-vite";

const meta: Meta<HlmDialog> = {
  title: "Dialog",
  component: HlmDialog,
  tags: ["autodocs"],
  decorators: [
    moduleMetadata({
      imports: [HlmDialogImports, HlmButton, HlmInput],
    }),
  ],
};

export default meta;
type Story = StoryObj<HlmDialog>;

export const Default: Story = {
  render: () => ({
    template: `
      <hlm-dialog>
        <button id="edit-profile" hlmDialogTrigger hlmBtn>Edit Profile</button>
        <hlm-dialog-content class="sm:max-w-106.25" *hlmDialogPortal="let ctx">
          <hlm-dialog-header>
            <h3 hlmDialogTitle>Edit profile</h3>
            <p hlmDialogDescription>
              Make changes to your profile here. Click save when you're done.
            </p>
          </hlm-dialog-header>
          <div class="grid gap-4 py-4">
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
          <hlm-dialog-footer>
            <button hlmBtn type="submit">Save changes</button>
          </hlm-dialog-footer>
        </hlm-dialog-content>
      </hlm-dialog>
    `,
  }),
};

@Component({
  selector: "hlm-nested-dialog-story",
  imports: [HlmDialogImports, HlmButton],
  template: `
    <hlm-dialog>
      <button hlmDialogTrigger hlmBtn>Open Dialog</button>
      <hlm-dialog-content *hlmDialogPortal>
        <hlm-dialog-header>
          <h3 hlmDialogTitle>First dialog</h3>
          <p hlmDialogDescription>Click the button below to open a nested dialog.</p>
        </hlm-dialog-header>

        <hlm-dialog>
          <button hlmDialogTrigger hlmBtn class="w-full">Open Nested Dialog</button>
          <hlm-dialog-content *hlmDialogPortal="let ctx">
            <hlm-dialog-header>
              <h3 hlmDialogTitle>Nested dialog</h3>
              <p hlmDialogDescription>I am a nested dialog!</p>
            </hlm-dialog-header>

            <button hlmBtn (click)="ctx.close()">Close Nested Dialog</button>
          </hlm-dialog-content>
        </hlm-dialog>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
class NestedDialogStory {}

export const NestedDialog: Story = {
  name: "Nested Dialog",
  decorators: [
    moduleMetadata({
      imports: [NestedDialogStory],
    }),
  ],
  render: () => ({
    template: "<hlm-nested-dialog-story />",
  }),
};

type ExampleUser = {
  name: string;
  email: string;
  phone: string;
};

@Component({
  selector: "hlm-dialog-select-user-story",
  imports: [HlmDialogImports],
  template: `
    <hlm-dialog-header>
      <h3 hlmDialogTitle>Select user</h3>
      <p hlmDialogDescription>Click a row to select a user.</p>
    </hlm-dialog-header>

    <table class="w-full text-sm">
      <thead>
        <tr class="border-b">
          <th class="h-10 px-2 text-start font-medium">Name</th>
          <th class="h-10 px-2 text-start font-medium">Email</th>
          <th class="h-10 px-2 text-start font-medium">Phone</th>
        </tr>
      </thead>
      <tbody>
        @for (user of users; track user.name) {
          <tr (click)="selectUser(user)" class="hover:bg-muted/50 cursor-pointer border-b">
            <td class="p-2 font-medium">{{ user.name }}</td>
            <td class="p-2">{{ user.email }}</td>
            <td class="p-2">{{ user.phone }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
  host: {
    class: "flex flex-col gap-4",
  },
})
class SelectUser {
  private readonly _hlmDialogService = inject(HlmDialogService);
  private readonly _dialogContext = injectBrnDialogContext<{ users: ExampleUser[] }>();

  protected readonly users = this._dialogContext.users;

  protected selectUser(user: ExampleUser) {
    this._hlmDialogService.open(SelectUser, {
      context: { users: [user] },
      contentClass: "sm:!max-w-[750px]",
    });
  }
}

@Component({
  selector: "hlm-dialog-dynamic-story",
  imports: [HlmButton],
  template: `
    <button hlmBtn (click)="openDynamicComponent()">Select User</button>
    <button hlmBtn (click)="openDynamicComponent(false)">
      Select Team (Dialog without close btn)
    </button>
  `,
})
class DialogDynamicStory {
  private readonly _hlmDialogService = inject(HlmDialogService);

  private readonly _users: ExampleUser[] = [
    { name: "Helena Chambers", email: "helenachambers@chorizon.com", phone: "+1 (812) 588-3759" },
    { name: "Josie Crane", email: "josiecrane@hinway.com", phone: "+1 (884) 523-3324" },
    { name: "Lou Hartman", email: "louhartman@optyk.com", phone: "+1 (912) 479-3998" },
    { name: "Lydia Zimmerman", email: "lydiazimmerman@ultrasure.com", phone: "+1 (944) 511-2111" },
  ];

  protected openDynamicComponent(showCloseButton = true) {
    const dialogRef = this._hlmDialogService.open(SelectUser, {
      context: { users: this._users },
      contentClass: "sm:!max-w-[750px]",
      showCloseButton,
    });

    dialogRef.closed$.subscribe((user) => {
      if (user) console.log("Selected user:", user);
    });
  }
}

export const DynamicComponent: Story = {
  name: "Dynamic Component",
  decorators: [
    moduleMetadata({
      imports: [DialogDynamicStory],
    }),
  ],
  render: () => ({
    template: "<hlm-dialog-dynamic-story />",
  }),
};

export const DynamicComponentWithDefaultOptions: Story = {
  name: "Dynamic Component with default options",
  decorators: [
    applicationConfig({
      providers: [provideBrnDialogDefaultOptions({ hasBackdrop: false })],
    }),
    moduleMetadata({
      imports: [DialogDynamicStory],
    }),
  ],
  render: () => ({
    template: "<hlm-dialog-dynamic-story />",
  }),
};

@Component({
  selector: "hlm-nested-dialog-dynamic-nested-story",
  imports: [HlmButton, HlmDialogImports],
  template: `
    <hlm-dialog-header>
      <h3 hlmDialogTitle>Nested dialog</h3>
      <p hlmDialogDescription>I am a nested dialog!</p>
    </hlm-dialog-header>

    <button hlmBtn (click)="close()">Close Nested Dialog</button>
  `,
  host: {
    class: "flex flex-col gap-4",
  },
})
class NestedDialogDynamicNested {
  private readonly _brnDialogRef = inject(BrnDialogRef);

  protected close() {
    this._brnDialogRef.close();
  }
}

@Component({
  selector: "hlm-nested-dialog-dynamic-first-story",
  imports: [HlmButton, HlmDialogImports],
  template: `
    <hlm-dialog-header>
      <h3 hlmDialogTitle>First dialog</h3>
      <p hlmDialogDescription>Click the button below to open a nested dialog.</p>
    </hlm-dialog-header>

    <button hlmBtn (click)="openNestedDialog()">Open Nested Dialog</button>
  `,
  host: {
    class: "flex flex-col gap-4",
  },
})
class NestedDialogDynamicFirst {
  private readonly _hlmDialogService = inject(HlmDialogService);

  protected openNestedDialog() {
    this._hlmDialogService.open(NestedDialogDynamicNested);
  }
}

@Component({
  selector: "hlm-nested-dialog-dynamic-story",
  imports: [HlmButton],
  template: `<button hlmBtn (click)="openDialog()">Open Dialog</button>`,
})
class NestedDialogDynamicStory {
  private readonly _hlmDialogService = inject(HlmDialogService);

  protected openDialog() {
    this._hlmDialogService.open(NestedDialogDynamicFirst);
  }
}

export const NestedDynamicComponent: Story = {
  name: "Nested Dynamic Component",
  decorators: [
    moduleMetadata({
      imports: [NestedDialogDynamicStory],
    }),
  ],
  render: () => ({
    template: "<hlm-nested-dialog-dynamic-story />",
  }),
};
