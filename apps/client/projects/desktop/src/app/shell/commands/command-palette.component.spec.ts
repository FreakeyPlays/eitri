import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { provideSpartanHlm } from "@ui/utils";
import { routes } from "../../app.routes";
import { CommandPaletteComponent } from "./command-palette.component";
import { LayoutService } from "@shell/layout/layout.service";

describe("CommandPaletteComponent", () => {
  beforeEach(() => {
    // jsdom lacks scrollIntoView, which the command list calls on its active item.
    Element.prototype.scrollIntoView = () => {};
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
    TestBed.configureTestingModule({
      providers: [provideSpartanHlm(), provideRouter(routes)],
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  async function render(url = "/") {
    const fixture = TestBed.createComponent(CommandPaletteComponent);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    const press = async (init: KeyboardEventInit) => {
      const event = new KeyboardEvent("keydown", { key: "k", cancelable: true, ...init });
      document.dispatchEvent(event);
      await fixture.whenStable();
      return event;
    };
    const buttons = () => [
      ...document.querySelectorAll<HTMLButtonElement>("button[data-slot=command-item]"),
    ];
    const items = () => buttons().map((el) => el.textContent?.trim());
    const groups = () =>
      [...document.querySelectorAll("[hlmCommandGroupLabel]")].map((el) => el.textContent);
    const select = async (label: string) => {
      buttons()
        .find((el) => el.textContent?.trim() === label)!
        .click();
      await fixture.whenStable();
    };
    return { press, items, groups, select };
  }

  it("opens and closes with ⌘K or Ctrl+K", async () => {
    const { press, items } = await render();
    expect(items()).toEqual([]);
    expect((await press({ key: "k" })).defaultPrevented).toBe(false);
    expect(items()).toEqual([]);
    expect((await press({ metaKey: true })).defaultPrevented).toBe(true);
    expect(items()).toContain("Settings");
    await press({ ctrlKey: true });
    await vi.waitFor(() => expect(items()).toEqual([]));
  });

  it("lists the app commands, then the open page's commands", async () => {
    const { press, items, groups } = await render();
    await press({ metaKey: true });
    expect(groups()).toEqual(["Navigation", "Workspace", "Projects"]);
    expect(items()).toEqual([
      "New Chat",
      "Settings",
      "Toggle sidebar",
      "Toggle terminal",
      "Toggle right panel",
      "Add Project",
    ]);
  });

  it("leaves out commands for panels and pages that aren't open", async () => {
    const { press, items, groups } = await render("/settings");
    await press({ metaKey: true });
    expect(groups()).toEqual(["Navigation", "Workspace"]);
    expect(items()).toEqual(["New Chat", "Settings", "Toggle sidebar"]);
  });

  it("closes before running a command", async () => {
    const { press, items, select } = await render();
    const navigate = vi.spyOn(TestBed.inject(Router), "navigateByUrl").mockResolvedValue(true);
    await press({ metaKey: true });
    await select("Settings");
    expect(navigate).toHaveBeenCalledWith("/settings");
    await vi.waitFor(() => expect(items()).toEqual([]));

    await press({ metaKey: true });
    await select("Toggle terminal");
    expect(TestBed.inject(LayoutService).isOpen("bottom")).toBe(true);
    await vi.waitFor(() => expect(items()).toEqual([]));

    await press({ metaKey: true });
    await select("Add Project");
    await vi.waitFor(() =>
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Add a project"),
    );
  });
});
