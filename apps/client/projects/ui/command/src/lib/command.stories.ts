import { Component, signal } from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { NgIcon, provideIcons } from "@ng-icons/core";
import {
  lucideCalendar,
  lucideCog,
  lucidePlus,
  lucideSmile,
  lucideUser,
  lucideWallet,
} from "@ng-icons/lucide";
import { HlmCommand, HlmCommandImports } from "@ui/command";
import { type Meta, type StoryObj, moduleMetadata } from "@storybook/angular-vite";

const meta: Meta<HlmCommand> = {
  title: "Command",
  component: HlmCommand,
  tags: ["autodocs"],
  decorators: [
    moduleMetadata({
      providers: [
        provideIcons({
          lucideCalendar,
          lucideCog,
          lucidePlus,
          lucideSmile,
          lucideUser,
          lucideWallet,
        }),
      ],
      imports: [HlmCommandImports, NgIcon],
    }),
  ],
};

export default meta;
type Story = StoryObj<HlmCommand>;

const items = [
  { label: "Profile", value: "Profile", icon: "lucideUser" },
  { label: "Billing", value: "Billing", icon: "lucideWallet" },
  { label: "Search Emoji", value: "Search Emoji", icon: "lucideSmile" },
  { label: "Settings", value: "Settings", icon: "lucideCog" },
];

export const Default: Story = {
  render: () => ({
    template: `
      <hlm-command>
        <hlm-command-input placeholder="Type a command or search..." />
        <hlm-command-list>
          <hlm-command-group>
            <hlm-command-group-label>Suggestions</hlm-command-group-label>

            <button hlm-command-item value="Calendar">
              <ng-icon name="lucideCalendar" />
              Calendar
            </button>
            <button disabled hlm-command-item value="Search Emoji">
              <ng-icon name="lucideSmile" />
              Search Emoji
            </button>
            <button hlm-command-item value="Calculator">
              <ng-icon name="lucidePlus" />
              Calculator
            </button>
          </hlm-command-group>

          <hlm-command-separator />

          <hlm-command-group>
            <hlm-command-group-label>Settings</hlm-command-group-label>

            <button hlm-command-item value="Profile">
              <ng-icon name="lucideUser" />
              Profile
              <hlm-command-shortcut>⌘P</hlm-command-shortcut>
            </button>
            <button hlm-command-item value="Billing">
              <ng-icon name="lucideWallet" />
              Billing
              <hlm-command-shortcut>⌘B</hlm-command-shortcut>
            </button>
            <button hlm-command-item value="Settings">
              <ng-icon name="lucideCog" />
              Settings
              <hlm-command-shortcut>⌘S</hlm-command-shortcut>
            </button>
          </hlm-command-group>
        </hlm-command-list>

        <!-- Empty state -->
        <div *hlmCommandEmptyState hlmCommandEmpty>No results found.</div>
      </hlm-command>
    `,
  }),
};

@Component({
  selector: "hlm-command-dialog-story",
  imports: [HlmCommandImports, NgIcon],
  host: {
    "(window:keydown)": "onKeyDown($event)",
  },
  template: `
    <div class="mx-auto flex max-w-screen-sm items-center justify-center space-x-4 py-20 text-sm">
      <p>
        Press
        <code class="bg-muted rounded px-[0.3rem] py-[0.2rem] font-mono font-semibold">⌘ + K</code>
      </p>
      <p>
        Last command:
        <code
          data-testid="lastCommand"
          class="bg-muted rounded px-[0.3rem] py-[0.2rem] font-mono font-semibold"
          >{{ command() || "none" }}</code
        >
      </p>
    </div>
    <hlm-command-dialog [state]="state()" (stateChange)="stateChanged($event)">
      <hlm-command>
        <hlm-command-input placeholder="Type a command or search..." />
        <hlm-command-list>
          <hlm-command-group>
            <hlm-command-group-label>Suggestions</hlm-command-group-label>

            <button hlm-command-item value="Calendar" (selected)="commandSelected('Calendar')">
              <ng-icon name="lucideCalendar" />
              Calendar
            </button>
            <button
              hlm-command-item
              disabled
              value="Search Emoji"
              (selected)="commandSelected('Search Emoji')"
            >
              <ng-icon name="lucideSmile" />
              Search Emoji
            </button>
            <button hlm-command-item value="Calculator" (selected)="commandSelected('Calculator')">
              <ng-icon name="lucidePlus" />
              Calculator
            </button>
          </hlm-command-group>

          <hlm-command-separator />

          <hlm-command-group>
            <hlm-command-group-label>Settings</hlm-command-group-label>

            <button hlm-command-item value="Profile" (selected)="commandSelected('Profile')">
              <ng-icon name="lucideUser" />
              Profile
              <hlm-command-shortcut>⌘P</hlm-command-shortcut>
            </button>
            <button hlm-command-item value="Billing" (selected)="commandSelected('Billing')">
              <ng-icon name="lucideWallet" />
              Billing
              <hlm-command-shortcut>⌘B</hlm-command-shortcut>
            </button>
            <button hlm-command-item value="Settings" (selected)="commandSelected('Settings')">
              <ng-icon name="lucideCog" />
              Settings
              <hlm-command-shortcut>⌘S</hlm-command-shortcut>
            </button>
          </hlm-command-group>
        </hlm-command-list>

        <!-- Empty state -->
        <div *hlmCommandEmptyState hlmCommandEmpty>No results found.</div>
      </hlm-command>
    </hlm-command-dialog>
  `,
})
class CommandDialog {
  protected readonly command = signal("");
  protected readonly state = signal<"closed" | "open">("closed");

  protected onKeyDown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      this.state.set("open");
    }
  }

  protected stateChanged(state: "open" | "closed") {
    this.state.set(state);
  }

  protected commandSelected(selected: string) {
    this.state.set("closed");
    this.command.set(selected);
  }
}

export const Dialog: Story = {
  decorators: [
    moduleMetadata({
      imports: [CommandDialog],
    }),
  ],
  render: () => ({
    template: "<hlm-command-dialog-story />",
  }),
};

@Component({
  selector: "hlm-command-dynamic-story",
  imports: [HlmCommandImports, NgIcon],
  template: `
    <hlm-command [search]="search()">
      <hlm-command-input placeholder="Type a command or search..." />
      <hlm-command-list>
        <hlm-command-group>
          <hlm-command-group-label>Suggestions</hlm-command-group-label>
          @for (item of items; track item.value) {
            <button hlm-command-item [value]="item.value" data-testid="command-item">
              <ng-icon [name]="item.icon" />
              {{ item.label }}
            </button>
          }
        </hlm-command-group>
      </hlm-command-list>

      <!-- Empty state -->
      <div *hlmCommandEmptyState hlmCommandEmpty>No results found.</div>
    </hlm-command>
  `,
})
class CommandDynamic {
  protected readonly search = signal("P");
  protected readonly items = items;
}

export const DynamicOptions: Story = {
  decorators: [
    moduleMetadata({
      imports: [CommandDynamic],
    }),
  ],
  render: () => ({
    template: "<hlm-command-dynamic-story />",
  }),
};

@Component({
  selector: "hlm-command-reactive-form-story",
  imports: [HlmCommandImports, NgIcon, ReactiveFormsModule],
  template: `
    <hlm-command [formControl]="searchControl">
      <hlm-command-input placeholder="Type a command or search..." />
      <hlm-command-list>
        <hlm-command-group>
          <hlm-command-group-label>Suggestions</hlm-command-group-label>
          @for (item of items; track item.value) {
            <button hlm-command-item [value]="item.value" data-testid="command-item">
              <ng-icon [name]="item.icon" />
              {{ item.label }}
            </button>
          }
        </hlm-command-group>
      </hlm-command-list>

      <!-- Empty state -->
      <div *hlmCommandEmptyState hlmCommandEmpty>No results found.</div>
    </hlm-command>
  `,
})
class CommandReactiveForm {
  protected readonly searchControl = new FormControl("R");
  protected readonly items = items;
}

export const ReactiveForm: Story = {
  decorators: [
    moduleMetadata({
      imports: [CommandReactiveForm],
    }),
  ],
  render: () => ({
    template: "<hlm-command-reactive-form-story />",
  }),
};

@Component({
  selector: "hlm-command-bound-value-story",
  imports: [HlmCommandImports, NgIcon],
  template: `
    <hlm-command [search]="search()">
      <hlm-command-input placeholder="Type a command or search..." />
      <hlm-command-list>
        <hlm-command-group>
          <hlm-command-group-label>Suggestions</hlm-command-group-label>
          @for (item of items; track item.value) {
            <button hlm-command-item [value]="item.value" data-testid="command-item">
              <ng-icon [name]="item.icon" />
              {{ item.label }}
            </button>
          }
        </hlm-command-group>
      </hlm-command-list>

      <!-- Empty state -->
      <div *hlmCommandEmptyState hlmCommandEmpty>No results found.</div>
    </hlm-command>
  `,
})
class CommandBoundValue {
  protected readonly search = signal("S");
  protected readonly items = items;
}

export const BoundValue: Story = {
  decorators: [
    moduleMetadata({
      imports: [CommandBoundValue],
    }),
  ],
  render: () => ({
    template: "<hlm-command-bound-value-story />",
  }),
};
