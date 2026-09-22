import { TestBed } from "@angular/core/testing";
import type { FolderListing } from "@eitri/contracts/folder";
import { provideSpartanHlm } from "@ui/utils";
import { ProjectService } from "@core/projects/project.service";
import { FolderBrowserComponent } from "./folder-browser.component";

const listing = (path = "/srv/work"): FolderListing => ({
  path,
  parentPath: "/srv",
  directories: [
    { name: "eitri", path: `${path}/eitri` },
    { name: "git", path: `${path}/git` },
    { name: "games", path: `${path}/games` },
  ],
  truncated: false,
});

describe("FolderBrowserComponent", () => {
  const listFolders = vi.fn<(path?: string) => Promise<FolderListing>>();

  beforeEach(() => {
    listFolders.mockReset().mockResolvedValue(listing());
    TestBed.configureTestingModule({
      providers: [provideSpartanHlm(), { provide: ProjectService, useValue: { listFolders } }],
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

    expect(listFolders).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(field.value).toBe("/srv/work/");

    button("eitri").click();
    expect(listFolders).toHaveBeenLastCalledWith("/srv/work/eitri");
  });

  it("walks up when a separator is deleted from the field", async () => {
    const { field, type } = await render();

    type("/srv/wor");

    expect(listFolders).toHaveBeenLastCalledWith("/srv");
    expect(field.value).toBe("/srv/wor");
  });

  it("filters the current listing by what follows the last separator", async () => {
    const { type, folders } = await render();

    type("/srv/work/g");

    expect(folders()).toEqual(["git", "games"]);
    expect(listFolders).toHaveBeenCalledOnce();
  });

  it("browses only when the folder ahead of the last separator changes", async () => {
    const { type } = await render();

    type("~/");
    expect(listFolders).toHaveBeenLastCalledWith("~");

    type("~/pro");
    expect(listFolders).toHaveBeenCalledTimes(2);

    type("~/projects/");
    expect(listFolders).toHaveBeenLastCalledWith("~/projects");
    expect(listFolders).toHaveBeenCalledTimes(3);
  });

  it("opens the first match when the filter is confirmed", async () => {
    const { fixture, field, type } = await render();

    type("/srv/work/ga");
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    fixture.detectChanges();

    expect(listFolders).toHaveBeenLastCalledWith("/srv/work/games");
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

  it("keeps the last listing but holds every choice while the next one loads", async () => {
    const { fixture, button } = await render();
    listFolders.mockReturnValue(new Promise(() => {}));

    button("eitri").click();
    fixture.detectChanges();

    expect(button("git").disabled).toBe(true);
    expect(button("Select this folder").disabled).toBe(true);
  });

  it("lets only the newest listing update what is shown", async () => {
    const answers: { resolve: (value: FolderListing) => void; reject: (e: Error) => void }[] = [];
    const { fixture, element, type, button } = await render();
    listFolders.mockImplementation(
      () => new Promise((resolve, reject) => answers.push({ resolve, reject })),
    );

    type("/first/");
    type("/second/");
    answers[1].resolve(listing("/second"));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(button("eitri").title).toBe("/second/eitri");
    });
    answers[0].reject(new Error("“/first” does not exist."));
    await new Promise((settle) => setTimeout(settle));
    fixture.detectChanges();

    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(button("eitri").title).toBe("/second/eitri");
    expect(button("Select this folder").disabled).toBe(false);
  });

  it("shows why a folder could not be browsed and refuses to select it", async () => {
    const { fixture, element, type, button } = await render();
    listFolders.mockRejectedValue(new Error("“/gone” does not exist."));

    type("/gone/");

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector('[role="alert"]')?.textContent).toContain("does not exist");
    });
    expect(button("Select this folder").disabled).toBe(true);
  });

  it("explains empty folders, no matches and truncated listings", async () => {
    listFolders.mockResolvedValueOnce({
      path: "/empty",
      parentPath: "/",
      directories: [],
      truncated: true,
    });
    const { fixture, element, type } = await render();

    expect(element.textContent).toContain("no subfolders");
    expect(element.textContent).toContain("More folders exist");

    type("/srv/work/nothing");
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.textContent).toContain("No folder here matches");
    });
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
