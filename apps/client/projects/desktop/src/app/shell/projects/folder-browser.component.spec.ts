import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideSpartanHlm } from "@ui/utils";
import { FolderBrowserService } from "@core/folders/folder-browser.service";
import { FolderBrowserComponent } from "./folder-browser.component";

const listing = () => ({
  path: "/srv/work",
  parentPath: "/srv",
  directories: [
    { name: "eitri", path: "/srv/work/eitri" },
    { name: "git", path: "/srv/work/git" },
    { name: "games", path: "/srv/work/games" },
  ],
  truncated: false,
});

describe("FolderBrowserComponent", () => {
  const current = signal(listing());
  const error = signal<string | null>(null);
  const loading = signal(false);
  const navigate = vi.fn<(path?: string) => Promise<boolean>>();

  beforeEach(() => {
    current.set(listing());
    error.set(null);
    loading.set(false);
    navigate.mockReset().mockResolvedValue(true);
    TestBed.configureTestingModule({ providers: [provideSpartanHlm()] });
    TestBed.overrideComponent(FolderBrowserComponent, {
      set: {
        providers: [
          {
            provide: FolderBrowserService,
            useValue: { current, error, loading, navigate },
          },
        ],
      },
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(FolderBrowserComponent);
    const selected = vi.fn();
    const cancelled = vi.fn();
    fixture.componentInstance.selected.subscribe(selected);
    fixture.componentInstance.cancelled.subscribe(cancelled);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const button = (label: string) =>
      [...element.querySelectorAll<HTMLButtonElement>("button")].find(
        (entry) => entry.textContent?.trim() === label,
      )!;
    const field = element.querySelector<HTMLInputElement>("input[name=folder-path]")!;
    const type = (value: string) => {
      field.value = value;
      field.dispatchEvent(new Event("input"));
      fixture.detectChanges();
    };
    const folders = () =>
      [...element.querySelectorAll<HTMLButtonElement>("button")]
        .map((entry) => entry.textContent?.trim())
        .filter((label) => !["Cancel", "Select this folder"].includes(label!));
    return { fixture, element, button, field, type, folders, selected, cancelled };
  }

  it("starts at home and navigates into a listed folder", async () => {
    const { button, field } = await render();

    expect(navigate).toHaveBeenCalledExactlyOnceWith();
    expect(field.value).toBe("/srv/work/");

    button("eitri").click();
    expect(navigate).toHaveBeenLastCalledWith("/srv/work/eitri");
  });

  it("walks up when a separator is deleted from the field", async () => {
    const { field, type } = await render();

    type("/srv/wor");

    expect(navigate).toHaveBeenLastCalledWith("/srv");
    expect(field.value).toBe("/srv/wor");
  });

  it("filters the current listing by what follows the last separator", async () => {
    const { type, folders } = await render();

    type("/srv/work/g");

    expect(folders()).toEqual(["git", "games"]);
    expect(navigate).toHaveBeenCalledExactlyOnceWith();
  });

  it("browses only when the folder ahead of the last separator changes", async () => {
    const { type } = await render();

    type("~/");
    expect(navigate).toHaveBeenLastCalledWith("~");

    type("~/pro");
    expect(navigate).toHaveBeenCalledTimes(2);

    type("~/projects/");
    expect(navigate).toHaveBeenLastCalledWith("~/projects");
    expect(navigate).toHaveBeenCalledTimes(3);
  });

  it("opens the first match when the filter is confirmed", async () => {
    const { fixture, field, type } = await render();

    type("/srv/work/ga");
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    fixture.detectChanges();

    expect(navigate).toHaveBeenLastCalledWith("/srv/work/games");
    expect(field.value).toBe("/srv/work/games/");
  });

  it("selects the current folder or cancels without selecting", async () => {
    const { button, selected, cancelled } = await render();

    button("Select this folder").click();
    expect(selected).toHaveBeenCalledExactlyOnceWith("/srv/work");

    button("Cancel").click();
    expect(cancelled).toHaveBeenCalledOnce();
    expect(selected).toHaveBeenCalledTimes(1);
  });

  it("disables navigation and selection while a response is pending", async () => {
    loading.set(true);
    const { button } = await render();

    expect(button("eitri").disabled).toBe(true);
    expect(button("Select this folder").disabled).toBe(true);
  });

  it("shows errors, empty folders, no matches and truncated listings", async () => {
    current.set({ path: "/empty", parentPath: "/", directories: [], truncated: true });
    error.set("Could not browse this folder.");
    const { element, button, type } = await render();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain("Could not browse");
    expect(element.textContent).toContain("no subfolders");
    expect(element.textContent).toContain("More folders exist");
    expect(button("Select this folder").disabled).toBe(true);

    current.set(listing());
    type("/srv/work/nothing");
    expect(element.textContent).toContain("No folder here matches");
  });

  it("holds every action while the project open request is pending", async () => {
    const { fixture, field, button, selected } = await render();
    fixture.componentRef.setInput("disabled", true);
    fixture.detectChanges();

    expect(field.disabled).toBe(true);
    expect(button("eitri").disabled).toBe(true);
    expect(button("Cancel").disabled).toBe(true);
    expect(button("Select this folder").disabled).toBe(true);
    button("Select this folder").click();
    expect(selected).not.toHaveBeenCalled();
  });
});
