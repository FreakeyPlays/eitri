import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type { Project } from "@eitri/contracts/project";
import { HlmDialogService } from "@ui/dialog";
import { provideSpartanHlm } from "@ui/utils";
import { ProjectService } from "@features/projects/project.service";
import { FolderBrowserComponent } from "../folder-browser/folder-browser.component";
import { ProjectMenuComponent } from "./project-menu.component";

const eitri = {
  id: "ca0dcace-34da-4b44-8364-13ce54a32e44",
  path: "/git/eitri",
  name: "eitri",
  lastOpenedAt: "2026-09-21T10:00:00.000Z",
};
const other = {
  id: "f035a77d-24b4-41c5-a2dc-93b56425d53a",
  path: "/git/other",
  name: "other",
  lastOpenedAt: "2026-09-20T10:00:00.000Z",
};

describe("ProjectMenuComponent", () => {
  const projects = signal<Project[]>([]);
  const active = signal<Project | null>(null);
  const error = signal<string | null>(null);
  const busy = signal(false);
  const open = vi.fn<(path: string) => Promise<boolean>>();
  const forget = vi.fn<(path: string) => Promise<boolean>>();
  const pickFolder = vi.fn<() => Promise<string | null>>();
  const load = vi.fn();
  const loaded = signal(true);
  const openDialog = vi.fn();
  const listFolders = vi.fn();
  let canPickFolder = true;

  beforeEach(() => {
    projects.set([]);
    active.set(null);
    error.set(null);
    busy.set(false);
    loaded.set(true);
    canPickFolder = true;
    open.mockReset().mockResolvedValue(true);
    forget.mockReset().mockResolvedValue(true);
    pickFolder.mockReset().mockResolvedValue(null);
    load.mockReset();
    openDialog.mockReset();
    listFolders.mockReset().mockResolvedValue({
      path: "/srv/work",
      directories: [],
      truncated: false,
    });
    TestBed.configureTestingModule({
      providers: [
        provideSpartanHlm(),
        { provide: HlmDialogService, useValue: { open: openDialog } },
        {
          provide: ProjectService,
          useFactory: () => ({
            projects,
            active,
            error,
            busy,
            loaded,
            canPickFolder,
            load,
            open,
            forget,
            pickFolder,
            listFolders,
          }),
        },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(ProjectMenuComponent);
    const chosen = vi.fn();
    fixture.componentInstance.chosen.subscribe(chosen);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const items = () => [
      ...element.querySelectorAll<HTMLButtonElement>(
        'ul[aria-label="Projects"] li > button[title]',
      ),
    ];
    const button = (label: string) =>
      [...element.querySelectorAll("button")].find((el) => el.textContent?.trim() === label);
    const settings = (name: string) =>
      element.querySelector<HTMLButtonElement>(`button[aria-label="Settings for ${name}"]`);
    return { fixture, element, items, button, settings, chosen };
  }

  it("lists what the user opened before, marking the open one", async () => {
    projects.set([other, eitri]);
    active.set(other);
    const { items } = await render();

    // Most recent first, names only; the path stays out of the way.
    expect(items()).toHaveLength(2);
    expect(items().map((item) => item.textContent?.replace("Open", "").trim())).toEqual([
      "other",
      "eitri",
    ]);
    // Reachable on hover, so two projects of the same name can still be told apart.
    expect(items().map((item) => item.getAttribute("title"))).toEqual(["/git/other", "/git/eitri"]);
    expect(items().map((item) => item.getAttribute("aria-current"))).toEqual(["true", null]);
  });

  it.each([{ collection: [eitri] }, { collection: [other, eitri] }])(
    "offers only individual projects for $collection.length known projects",
    async ({ collection }) => {
      projects.set(collection);
      active.set(collection[0]);
      const { element, items } = await render();

      expect(element.textContent).not.toContain("All projects");
      expect(element.querySelectorAll('ul[aria-label="Projects"] > li')).toHaveLength(
        collection.length,
      );
      expect(items()).toHaveLength(collection.length);
    },
  );

  it("offers settings on every entry without waiting for a hover", async () => {
    projects.set([other, eitri]);
    active.set(other);
    const { settings, chosen } = await render();

    for (const project of [eitri, other]) {
      const entry = settings(project.name);
      expect(entry).toBeDefined();
      expect(entry!.className).not.toContain("opacity-0");
    }

    settings("eitri")!.click();

    expect(openDialog).toHaveBeenCalledOnce();
    expect(openDialog.mock.calls[0][1]).toMatchObject({ context: { project: eitri } });
    // Naming and removal happen in the dialog, so the dropdown stays open.
    expect(chosen).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("shows every project without a search bar", async () => {
    projects.set([other, eitri]);
    const { element, items, button } = await render();

    expect(element.querySelector("input")).toBeNull();
    expect(items().map((item) => item.title)).toEqual([other.path, eitri.path]);
    expect(items().every((item) => item.type === "button" && item.tabIndex === 0)).toBe(true);
    expect(button("Open folder…")?.disabled).toBe(false);
  });

  it("reports the chosen project, so the dropdown can close", async () => {
    projects.set([eitri]);
    const { items, chosen } = await render();

    items()[0].click();

    await vi.waitFor(() => expect(chosen).toHaveBeenCalledOnce());
    expect(open).toHaveBeenCalledExactlyOnceWith(eitri.path);
  });

  it("stays put with the reason when a project cannot be opened", async () => {
    projects.set([eitri]);
    open.mockImplementation(async (path) => {
      error.set(`“${path}” does not exist.`);
      return false;
    });
    const { element, items, chosen } = await render();

    items()[0].click();

    await vi.waitFor(() => expect(element.textContent).toContain("does not exist"));
    // Nothing reported, so the dropdown keeps showing the message.
    expect(chosen).not.toHaveBeenCalled();
  });

  it("explains an empty list and offers one action to open a folder", async () => {
    const { element, button } = await render();

    expect(element.textContent).toContain("No projects yet");
    expect(element.textContent).toContain("Open a folder to start your first project.");
    expect(element.querySelector("input")).toBeNull();
    expect(element.querySelectorAll("button")).toHaveLength(1);
    expect(button("Open folder…")?.disabled).toBe(false);
  });

  it("opens the folder the desktop picker returned", async () => {
    pickFolder.mockResolvedValue("/git/picked");
    const { button, chosen } = await render();

    button("Open folder…")!.click();

    await vi.waitFor(() => expect(open).toHaveBeenCalledExactlyOnceWith("/git/picked"));
    await vi.waitFor(() => expect(chosen).toHaveBeenCalledOnce());
  });

  it("opens nothing when the desktop picker was dismissed", async () => {
    const { button, chosen } = await render();

    button("Open folder…")!.click();

    await vi.waitFor(() => expect(pickFolder).toHaveBeenCalled());
    expect(open).not.toHaveBeenCalled();
    expect(chosen).not.toHaveBeenCalled();
  });

  it("opens the server folder browser on web and selects through the project flow", async () => {
    canPickFolder = false;
    const { fixture, element, button, chosen } = await render();

    button("Open folder…")!.click();
    await fixture.whenStable();

    const browser = fixture.debugElement.query(
      (node) => node.componentInstance instanceof FolderBrowserComponent,
    ).componentInstance as FolderBrowserComponent;
    expect(element.querySelector("input[name=folder-path]")).not.toBeNull();
    browser.selected.emit("/srv/work");

    await vi.waitFor(() => expect(open).toHaveBeenCalledExactlyOnceWith("/srv/work"));
    await vi.waitFor(() => expect(chosen).toHaveBeenCalledOnce());
  });

  it("keeps the server folder browser open when the project cannot be opened", async () => {
    canPickFolder = false;
    open.mockResolvedValue(false);
    const { fixture, element, button, chosen } = await render();

    button("Open folder…")!.click();
    await fixture.whenStable();
    const browser = fixture.debugElement.query(
      (node) => node.componentInstance instanceof FolderBrowserComponent,
    ).componentInstance as FolderBrowserComponent;
    browser.selected.emit("/srv/missing");

    await vi.waitFor(() => expect(open).toHaveBeenCalledExactlyOnceWith("/srv/missing"));
    expect(element.querySelector("app-folder-browser")).not.toBeNull();
    expect(chosen).not.toHaveBeenCalled();
  });

  it("cannot cancel the browser while its selected project is still opening", async () => {
    canPickFolder = false;
    let finishOpen!: (opened: boolean) => void;
    open.mockImplementation(
      () =>
        new Promise((resolve) => {
          busy.set(true);
          finishOpen = (opened) => {
            busy.set(false);
            resolve(opened);
          };
        }),
    );
    const { fixture, element, button, chosen } = await render();

    button("Open folder…")!.click();
    await fixture.whenStable();
    const browser = fixture.debugElement.query(
      (node) => node.componentInstance instanceof FolderBrowserComponent,
    ).componentInstance as FolderBrowserComponent;
    browser.selected.emit("/srv/work");
    await vi.waitFor(() => expect(open).toHaveBeenCalledExactlyOnceWith("/srv/work"));
    fixture.detectChanges();

    expect(button("Cancel")!.disabled).toBe(true);
    button("Cancel")!.click();
    expect(element.querySelector("app-folder-browser")).not.toBeNull();

    finishOpen(true);
    await vi.waitFor(() => expect(chosen).toHaveBeenCalledOnce());
  });

  it("returns from the server folder browser without changing selection", async () => {
    canPickFolder = false;
    const { fixture, element, button } = await render();

    button("Open folder…")!.click();
    await fixture.whenStable();
    button("Cancel")!.click();
    await fixture.whenStable();

    expect(element.querySelector("app-folder-browser")).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });

  it("offers to read the list again after it failed", async () => {
    loaded.set(false);
    error.set("Could not reach the Eitri server.");
    const { element, button } = await render();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain("Could not reach");
    button("Try again")!.click();

    expect(load).toHaveBeenCalledOnce();
  });

  it("offers no retry for a refused action once the list was read", async () => {
    projects.set([eitri]);
    error.set("“/git/gone” does not exist.");
    const { element, button } = await render();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain("does not exist");
    expect(button("Try again")).toBeUndefined();
  });

  it("holds actions while a request is still running", async () => {
    projects.set([eitri]);
    busy.set(true);
    loaded.set(false);
    error.set("Could not reach the Eitri server.");
    const { items, button, settings, chosen } = await render();

    expect(button("Open folder…")?.disabled).toBe(true);
    expect(button("Try again")?.disabled).toBe(true);
    expect(items()[0].disabled).toBe(true);
    expect(settings("eitri")?.disabled).toBe(true);
    items()[0].click();
    settings("eitri")!.click();
    expect(open).not.toHaveBeenCalled();
    expect(openDialog).not.toHaveBeenCalled();
    expect(chosen).not.toHaveBeenCalled();
  });
});
