import { NgIcon, provideIcons } from "@ng-icons/core";
import {
  lucideCalendar,
  lucideEllipsis,
  lucideHouse,
  lucideInbox,
  lucideSearch,
  lucideSettings,
} from "@ng-icons/lucide";
import { HlmSidebar, HlmSidebarImports } from "@ui/sidebar";
import { type Meta, type StoryObj, moduleMetadata } from "@storybook/angular-vite";

const meta: Meta<HlmSidebar> = {
  title: "Sidebar",
  component: HlmSidebar,
  tags: ["autodocs"],
  decorators: [
    moduleMetadata({
      imports: [HlmSidebarImports, NgIcon],
      providers: [
        provideIcons({
          lucideCalendar,
          lucideEllipsis,
          lucideHouse,
          lucideInbox,
          lucideSearch,
          lucideSettings,
        }),
      ],
    }),
  ],
};

export default meta;
type Story = StoryObj<HlmSidebar>;

const sidebar = (side: "left" | "right") => `
  <hlm-sidebar side="${side}">
    <div hlmSidebarHeader>
      <h1 class="text-2xl font-bold">My app</h1>
      <div hlmSidebarGroup>
        <div hlmSidebarGroupContent class="relative">
          <input hlmSidebarInput placeholder="Search" class="pl-8" />
          <ng-icon
            name="lucideSearch"
            class="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none"
          />
        </div>
      </div>
    </div>
    <div hlmSidebarContent>
      <div hlmSidebarGroup>
        <div hlmSidebarGroupLabel>Application</div>
        <button hlmSidebarGroupAction>
          <ng-icon name="lucideEllipsis" />
        </button>

        <div hlmSidebarGroupContent>
          <ul hlmSidebarMenu>
            <li hlmSidebarMenuItem>
              <button hlmSidebarMenuButton aria-describedby="Home" [isActive]="true">
                <ng-icon name="lucideHouse" />
                <span>Home</span>
              </button>
              <ul hlmSidebarMenuSub>
                <li hlmSidebarMenuSubItem>
                  <a hlmSidebarMenuSubButton>
                    <ng-icon name="lucideHouse" />
                    <span>Home</span>
                  </a>
                </li>
                <li hlmSidebarMenuSubItem>
                  <a hlmSidebarMenuSubButton>
                    <ng-icon name="lucideHouse" />
                    <span>Home</span>
                  </a>
                </li>
              </ul>
            </li>

            <li hlmSidebarMenuItem>
              <button hlmSidebarMenuButton aria-describedby="Home">
                <ng-icon name="lucideHouse" />
                <span>Home</span>
              </button>
              <button hlmSidebarMenuAction aria-describedby="Home">
                <ng-icon name="lucideEllipsis" />
              </button>
            </li>

            <li hlmSidebarMenuItem>
              <button hlmSidebarMenuButton tooltip="Inbox" aria-describedby="Inbox">
                <ng-icon name="lucideInbox" />
                <span>Inbox</span>
              </button>
            </li>
            <li hlmSidebarMenuItem>
              <button hlmSidebarMenuButton tooltip="Calendar" aria-describedby="Calendar">
                <ng-icon name="lucideCalendar" />
                <span>Calendar</span>
              </button>
            </li>

            <hlm-sidebar-separator />

            <li hlmSidebarMenuItem>
              <button hlmSidebarMenuButton tooltip="Search" aria-describedby="Search">
                <ng-icon name="lucideSearch" />
                <span>Search</span>
                <div hlmSidebarMenuBadge>10</div>
              </button>
            </li>

            <li hlmSidebarMenuItem>
              <button hlmSidebarMenuButton tooltip="Settings" aria-describedby="Settings">
                <ng-icon name="lucideSettings" />
                <span>Settings</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
      <div hlmSidebarGroup>
        <div hlmSidebarGroupLabel>Application1</div>
        <div hlmSidebarGroupContent>
          <ul hlmSidebarMenu>
            <li hlmSidebarMenuItem>
              <button hlmSidebarMenuButton tooltip="Home" aria-describedby="Home">
                <ng-icon name="lucideHouse" />
                <span>Home</span>
              </button>
            </li>
            <li hlmSidebarMenuItem>
              <button hlmSidebarMenuButton tooltip="Inbox" aria-describedby="Inbox">
                <ng-icon name="lucideInbox" />
                <span>Inbox</span>
              </button>
            </li>
            <li hlmSidebarMenuItem>
              <button hlmSidebarMenuButton tooltip="Calendar" aria-describedby="Calendar">
                <ng-icon name="lucideCalendar" />
                <span>Calendar</span>
              </button>
            </li>
            <li hlmSidebarMenuItem>
              <button hlmSidebarMenuButton tooltip="Search" aria-describedby="Search">
                <ng-icon name="lucideSearch" />
                <span>Search</span>
              </button>
            </li>
            <li hlmSidebarMenuItem>
              <button hlmSidebarMenuButton tooltip="Settings" aria-describedby="Settings">
                <ng-icon name="lucideSettings" />
                <span>Settings</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div hlmSidebarFooter>
      <button hlmSidebarMenuButton tooltip="Settings" aria-describedby="Settings">
        <ng-icon name="lucideSettings" />
        <span>Settings</span>
      </button>
    </div>

    <!-- Rail for resizing -->
    <button hlmSidebarRail></button>
  </hlm-sidebar>
`;

const inset = `
  <main hlmSidebarInset>
    <div class="flex h-screen w-full flex-col items-center justify-center">
      <button hlmSidebarTrigger></button>
      <h1 class="text-2xl font-bold">Hello World</h1>
    </div>
  </main>
`;

export const Default: Story = {
  render: () => ({
    template: `<div hlmSidebarWrapper>${sidebar("left")}${inset}</div>`,
  }),
};

export const RightSide: Story = {
  render: () => ({
    template: `<div hlmSidebarWrapper>${inset}${sidebar("right")}</div>`,
  }),
};
