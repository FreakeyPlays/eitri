import { TestBed } from "@angular/core/testing";
import type { FolderListing } from "@eitri/contracts/folder";
import { provideSpartanHlm } from "@ui/utils";
import { ProjectService } from "@features/projects/project.service";
import { FolderBrowserComponent } from "./folder-browser.component";

const listing = (path = "/home/me"): FolderListing => ({
  path,
  directories: [
    { name: ".cache", path: `${path}/.cache` },
    { name: "eitri", path: `${path}/eitri` },
    { name: "games", path: `${path}/games` },
    { name: "git", path: `${path}/git` },
    { name: "legit", path: `${path}/legit` },
  ],
  truncated: false,
});

describe("FolderBrowserComponent", () => {
  const listFolders = vi.fn<(path?: string) => Promise<FolderListing>>();
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    Element.prototype.scrollIntoView = scrollIntoView.mockReset();
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
    const options = () => [...element.querySelectorAll<HTMLElement>("[role=option]")];
    const row = (name: string) => options().find((entry) => entry.textContent?.trim() === name)!;
    const rows = () => options().map((entry) => entry.textContent?.trim());
    const highlighted = () =>
      options()
        .find((entry) => entry.getAttribute("aria-selected") === "true")
        ?.textContent?.trim();
    const field = element.querySelector<HTMLInputElement>("input[name=folder-path]")!;
    const type = (value: string) => {
      field.value = value;
      field.dispatchEvent(new Event("input"));
      fixture.detectChanges();
    };
    const press = (key: string, init: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent("keydown", { key, cancelable: true, ...init });
      field.dispatchEvent(event);
      fixture.detectChanges();
      return event;
    };
    const settle = () =>
      vi.waitFor(() => {
        fixture.detectChanges();
        expect(element.querySelector("[aria-busy=true]")).toBeNull();
      });
    return {
      fixture,
      element,
      button,
      field,
      type,
      press,
      row,
      rows,
      highlighted,
      settle,
      selected,
      cancelled,
    };
  }

  it("starts at ~/ and keeps the field in that form while stepping into a folder", async () => {
    const { fixture, field, row } = await render();

    expect(listFolders).toHaveBeenCalledExactlyOnceWith("~");
    expect(field.value).toBe("~/");

    row("eitri").click();
    fixture.detectChanges();
    expect(listFolders).toHaveBeenLastCalledWith("~/eitri");
    expect(field.value).toBe("~/eitri/");
  });

  it("offers nothing to open until the first listing arrives", async () => {
    listFolders.mockReturnValue(new Promise(() => {}));
    const { fixture, element, rows, button } = await render();
    fixture.detectChanges();

    expect(element.textContent).toContain("Loading folders");
    expect(rows()).toEqual([]);
    expect(element.querySelector<HTMLElement>("span[title]")?.title).toBe("");
    expect(button("Open").disabled).toBe(true);
  });

  it("focuses the field on start and again after stepping into a folder", async () => {
    const { fixture, field, row } = await render();
    expect(document.activeElement).toBe(field);

    field.blur();
    row("eitri").click();
    fixture.detectChanges();

    expect(document.activeElement).toBe(field);
  });

  it("mutes the way up against the folders", async () => {
    const { row } = await render();

    expect(row("..").classList.contains("text-muted-foreground")).toBe(true);
    expect(row("git").classList.contains("text-muted-foreground")).toBe(false);
  });

  it("hides dot folders until the filter asks for them", async () => {
    const { rows, type } = await render();

    expect(rows()).toEqual(["..", "eitri", "games", "git", "legit"]);

    type("~/.c");
    expect(rows()).toEqual([".cache"]);
  });

  it("filters by prefix first, then by containment, without the way up", async () => {
    const { rows, type } = await render();

    type("~/gi");

    expect(rows()).toEqual(["git", "legit"]);
    expect(listFolders).toHaveBeenCalledOnce();
  });

  it("goes up from ~/ to the real parent of home", async () => {
    const { fixture, field, row } = await render();

    row("..").click();
    fixture.detectChanges();

    expect(listFolders).toHaveBeenLastCalledWith("/home");
    expect(field.value).toBe("/home/");
  });

  it("offers no way up at the root", async () => {
    listFolders.mockResolvedValue(listing("/"));
    const { rows, type, settle } = await render();

    type("/");
    await settle();

    expect(rows()[0]).not.toBe("..");
  });

  it("does not browse before the field holds a folder", async () => {
    const { field, type } = await render();

    type("g");

    expect(field.value).toBe("g");
    expect(listFolders).toHaveBeenCalledOnce();
  });

  it("does not browse again when filtering inside the folder it stepped into", async () => {
    const { fixture, row, type } = await render();
    row("eitri").click();
    fixture.detectChanges();

    type("~/eitri/g");

    expect(listFolders).toHaveBeenCalledTimes(2);
  });

  it("walks up when a separator is deleted from the field", async () => {
    const { field, type } = await render();

    type("~/eitri/");
    type("~/eitr");

    expect(listFolders).toHaveBeenLastCalledWith("~");
    expect(field.value).toBe("~/eitr");
  });

  it("steps into the best match with Enter and moves the highlight with the arrows", async () => {
    const { field, type, press, highlighted, settle } = await render();

    type("~/g");
    expect(highlighted()).toBe("games");
    press("ArrowDown");
    expect(highlighted()).toBe("git");
    press("Enter");

    expect(listFolders).toHaveBeenLastCalledWith("~/git");
    expect(field.value).toBe("~/git/");
    await settle();
    expect(highlighted()).toBeUndefined();
  });

  it("moves the highlight both ways and stops at the ends of the list", async () => {
    const { type, press, highlighted } = await render();

    type("~/g");
    for (let step = 0; step < 4; step++) press("ArrowDown");
    expect(highlighted()).toBe("legit");

    press("ArrowUp");
    expect(highlighted()).toBe("git");
    for (let step = 0; step < 4; step++) press("ArrowUp");
    expect(highlighted()).toBe("games");
  });

  it("scrolls the highlighted folder into view", async () => {
    const { press, row } = await render();

    press("ArrowDown");

    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: "nearest" });
    expect(scrollIntoView.mock.contexts[0]).toBe(row(".."));
  });

  it("leaves the arrows alone when no folder matches", async () => {
    const { type, press, highlighted } = await render();
    type("~/nothing");

    press("ArrowDown");

    expect(highlighted()).toBeUndefined();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("takes over arrows and Enter from the field, and no other key", async () => {
    const { press, selected } = await render();

    expect(press("a").defaultPrevented).toBe(false);
    expect(selected).not.toHaveBeenCalled();
    expect(listFolders).toHaveBeenCalledOnce();

    expect(press("ArrowDown").defaultPrevented).toBe(true);
    expect(press("ArrowUp").defaultPrevented).toBe(true);
    expect(press("Enter").defaultPrevented).toBe(true);
  });

  it("ignores keys while an input method is composing", async () => {
    const { press, highlighted, selected } = await render();

    press("ArrowDown", { isComposing: true });
    press("Enter", { isComposing: true });

    expect(highlighted()).toBeUndefined();
    expect(selected).not.toHaveBeenCalled();
  });

  it("drops an arrow highlight when stepping into a folder without a filter", async () => {
    const { field, press, highlighted, settle } = await render();

    press("ArrowDown");
    press("ArrowDown");
    press("ArrowDown");
    expect(highlighted()).toBe("games");
    listFolders.mockResolvedValue({ path: "/home/me/games", directories: [], truncated: false });
    press("Enter");
    await settle();

    expect(field.value).toBe("~/games/");
    expect(highlighted()).toBeUndefined();
    expect(field.hasAttribute("aria-activedescendant")).toBe(false);
  });

  it("opens the folder shown when Enter has nothing highlighted", async () => {
    const { press, selected } = await render();

    press("Enter");

    expect(selected).toHaveBeenCalledExactlyOnceWith("/home/me");
  });

  it("opens a folder the filter names exactly with ⌘ Enter, by its canonical path", async () => {
    const { element, type, press, selected } = await render();

    type("~/git");
    expect(element.textContent).toContain("~/git");
    press("Enter", { metaKey: true });

    expect(selected).toHaveBeenCalledExactlyOnceWith("/home/me/git");
  });

  it("opens the folder shown or cancels without opening", async () => {
    const { button, selected, cancelled } = await render();

    button("Open").click();
    expect(selected).toHaveBeenCalledExactlyOnceWith("/home/me");

    button("Cancel").click();
    expect(cancelled).toHaveBeenCalledOnce();
    expect(selected).toHaveBeenCalledTimes(1);
  });

  it("keeps the last listing but cannot open while the next one loads", async () => {
    const { fixture, row, button } = await render();
    listFolders.mockReturnValue(new Promise(() => {}));

    row("eitri").click();
    fixture.detectChanges();

    expect(row("git")).toBeDefined();
    expect(button("Open").disabled).toBe(true);
  });

  it("lets only the newest listing update what is shown", async () => {
    const answers: { resolve: (value: FolderListing) => void; reject: (e: Error) => void }[] = [];
    const { fixture, element, type, row, button } = await render();
    listFolders.mockImplementation(
      () => new Promise((resolve, reject) => answers.push({ resolve, reject })),
    );

    type("/first/");
    type("/second/");
    answers[1].resolve(listing("/second"));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(row("eitri").title).toBe("/second/eitri/");
    });
    answers[0].reject(new Error("“/first” does not exist."));
    await new Promise((settle) => setTimeout(settle));
    fixture.detectChanges();

    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(row("eitri").title).toBe("/second/eitri/");
    expect(button("Open").disabled).toBe(false);
  });

  it("keeps an older listing from replacing the newest or ending its loading", async () => {
    const answers: ((value: FolderListing) => void)[] = [];
    const { fixture, type, row, button } = await render();
    listFolders.mockImplementation(() => new Promise((resolve) => answers.push(resolve)));
    const afterAnswer = async () => {
      await new Promise((settle) => setTimeout(settle));
      fixture.detectChanges();
    };

    type("/first/");
    type("/second/");
    answers[0](listing("/first"));
    await afterAnswer();

    expect(row("eitri").title).toBe("~/eitri/");
    expect(button("Open").disabled).toBe(true);

    answers[1](listing("/second"));
    await afterAnswer();

    expect(row("eitri").title).toBe("/second/eitri/");
    expect(button("Open").disabled).toBe(false);
  });

  it("drops the reason once another folder is browsed", async () => {
    const { fixture, element, type } = await render();
    const alert = () => element.querySelector('[role="alert"]');
    listFolders.mockRejectedValueOnce(new Error("“/gone” does not exist."));

    type("/gone/");
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(alert()).not.toBeNull();
    });
    type("~/");

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(alert()).toBeNull();
    });
  });

  it("keeps Enter from opening a stale folder after browsing failed", async () => {
    const { fixture, element, field, type, press, selected } = await render();
    listFolders.mockRejectedValue(new Error("“/gone” does not exist."));

    type("/gone/g");
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector('[role="alert"]')).not.toBeNull();
    });
    press("Enter");

    expect(field.value).toBe("/gone/g");
    expect(listFolders).toHaveBeenCalledTimes(2);
    expect(selected).not.toHaveBeenCalled();
  });

  it("shows why a folder could not be browsed and refuses to open it", async () => {
    const { fixture, element, type, button } = await render();
    listFolders.mockRejectedValue(new Error("“/gone” does not exist."));

    type("/gone/");

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector('[role="alert"]')?.textContent).toContain("does not exist");
    });
    expect(button("Open").disabled).toBe(true);
    // The list is gone, so the field no longer points at it.
    const field = element.querySelector("input[name=folder-path]")!;
    expect(field.getAttribute("aria-expanded")).toBe("false");
    expect(field.hasAttribute("aria-controls")).toBe(false);
  });

  it("explains empty folders, no matches and truncated listings", async () => {
    listFolders.mockResolvedValueOnce({ path: "/empty", directories: [], truncated: true });
    const { element, type } = await render();

    expect(element.textContent).toContain("no subfolders");
    expect(element.textContent).toContain("More folders exist");

    type("~/nothing");
    expect(element.textContent).toContain("No matching folder found.");
  });

  it("holds every action while the project open request is pending", async () => {
    const { fixture, field, row, button, press, selected } = await render();
    fixture.componentRef.setInput("disabled", true);
    fixture.detectChanges();

    expect(field.disabled).toBe(true);
    expect(button("Cancel").disabled).toBe(true);
    expect(button("Open").disabled).toBe(true);
    row("eitri").click();
    press("Enter");
    expect(listFolders).toHaveBeenCalledOnce();
    expect(selected).not.toHaveBeenCalled();
  });
});
