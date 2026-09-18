import { Component, signal } from "@angular/core";
import { HlmButton } from "@ui/button";
import { HlmResizableGroup, HlmResizableImports } from "@ui/resizable";
import { type Meta, type StoryObj, moduleMetadata } from "@storybook/angular-vite";

@Component({
  selector: "hlm-resizable-story",
  imports: [HlmResizableImports],
  template: `
    <hlm-resizable-group class="h-50 w-125 max-w-md rounded-lg border">
      <hlm-resizable-panel>
        <div class="flex h-full items-center justify-center p-6">One</div>
      </hlm-resizable-panel>
      <hlm-resizable-handle />
      <hlm-resizable-panel>
        <hlm-resizable-group direction="vertical">
          <hlm-resizable-panel>
            <div class="flex h-full items-center justify-center p-6">
              <span class="font-semibold">Two</span>
            </div>
          </hlm-resizable-panel>
          <hlm-resizable-handle />
          <hlm-resizable-panel>
            <div class="flex h-full items-center justify-center p-6">
              <span class="font-semibold">Three</span>
            </div>
          </hlm-resizable-panel>
        </hlm-resizable-group>
      </hlm-resizable-panel>
    </hlm-resizable-group>
  `,
})
class ResizableExample {}

@Component({
  selector: "hlm-resizable-dynamic-panels-story",
  imports: [HlmResizableImports, HlmButton],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-4">
        <button
          hlmBtn
          variant="outline"
          type="button"
          (click)="showExtra.update((value) => !value)"
        >
          {{ showExtra() ? "Remove" : "Add" }} extra panel
        </button>
        <span class="text-muted-foreground text-sm">Layout: {{ layout().join(", ") }}</span>
      </div>

      <hlm-resizable-group
        direction="vertical"
        class="h-90 w-125 max-w-md rounded-lg border"
        [(layout)]="layout"
      >
        <hlm-resizable-panel [defaultSize]="25">
          <div class="flex h-full items-center justify-center p-6 font-semibold">Header</div>
        </hlm-resizable-panel>
        <hlm-resizable-handle withHandle />
        <hlm-resizable-panel [defaultSize]="75">
          <div class="flex h-full items-center justify-center p-6 font-semibold">Content</div>
        </hlm-resizable-panel>
        @if (showExtra()) {
          <hlm-resizable-handle withHandle />
          <hlm-resizable-panel [defaultSize]="25">
            <div class="flex h-full items-center justify-center p-6 font-semibold">
              Extra Dynamic Panel
            </div>
          </hlm-resizable-panel>
        }
      </hlm-resizable-group>
    </div>
  `,
})
class ResizableDynamicPanelsExample {
  protected readonly showExtra = signal(false);
  protected readonly layout = signal<number[]>([]);
}

const meta: Meta<HlmResizableGroup> = {
  title: "Resizable",
  component: HlmResizableGroup,
  tags: ["autodocs"],
  decorators: [
    moduleMetadata({
      imports: [ResizableExample, ResizableDynamicPanelsExample],
    }),
  ],
};

export default meta;
type Story = StoryObj<HlmResizableGroup>;

export const Default: Story = {
  render: () => ({
    template: "<hlm-resizable-story />",
  }),
};

export const DynamicPanels: Story = {
  render: () => ({
    template: "<hlm-resizable-dynamic-panels-story />",
  }),
};
