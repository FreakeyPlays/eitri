import { computed, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type { Project } from "@eitri/contracts/project";
import { provideSpartanHlm } from "@ui/utils";
import { ProjectService } from "@core/projects/project.service";
import { ProjectMenuComponent } from "./project-menu.component";

const eitri = { path: "/git/eitri", name: "eitri", lastOpenedAt: "2026-09-21T10:00:00.000Z" };
const other = { path: "/git/other", name: "other", lastOpenedAt: "2026-09-20T10:00:00.000Z" };

describe("ProjectMenuComponent", () => {
  const projects = signal<Project[]>([]);
  const active = signal<Project | null>(null);
  const notice = signal<string | null>(null);
  const error = signal<string | null>(null);
  const busy = signal(false);
  const open = vi.fn<(path: string) => Promise<boolean>>();
  const openAll = vi.fn<() => Promise<boolean>>();
  const forget = vi.fn<(path: string) => Promise<boolean>>();
  const browse = vi.fn<() => Promise<string | null>>();
  const load = vi.fn();
  let canBrowse = true;

  beforeEach(() => {
    projects.set([]);
    active.set(null);
    notice.set(null);
    error.set(null);
    busy.set(false);
    canBrowse = true;
    open.mockReset().mockResolvedValue(true);
    openAll.mockReset().mockResolvedValue(true);
    forget.mockReset().mockResolvedValue(true);
    browse.mockReset().mockResolvedValue(null);
    load.mockReset();
    // jsdom lacks scrollIntoView, which the command list calls on its active item.
    Element.prototype.scrollIntoView = () => {};
    TestBed.configureTestingModule({
      providers: [
        provideSpartanHlm(),
        {
          provide: ProjectService,
          useFactory: () => ({
            projects,
            active,
            allSelected: computed(() => active() === null),
            notice,
            error,
            busy,
            canBrowse,
            load,
            open,
            openAll,
            forget,
            browse,
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
    // Only project rows carry a title; the "All projects" entry has none.
    const items = () => [
      ...element.querySelectorAll<HTMLButtonElement>("button[data-slot=command-item][title]"),
    ];
    const allEntry = () =>
      [...element.querySelectorAll<HTMLButtonElement>("button[data-slot=command-item]")].find(
        (item) => item.textContent?.includes("All projects"),
      );
    const button = (label: string) =>
      [...element.querySelectorAll("button")].find((el) => el.textContent?.trim() === label);
    const remove = (name: string) =>
      element.querySelector<HTMLButtonElement>(`button[aria-label="Remove ${name} from the list"]`);
    return { fixture, element, items, allEntry, button, remove, chosen };
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

  it("does not offer working across projects with only one of them", async () => {
    projects.set([eitri]);
    active.set(eitri);
    const { allEntry } = await render();

    expect(allEntry()).toBeUndefined();
  });

  it("offers working across projects once there are several", async () => {
    projects.set([other, eitri]);
    active.set(null);
    const { allEntry } = await render();

    expect(allEntry()).toBeDefined();
    // Marked like any other selection, so the current scope is obvious.
    expect(allEntry()!.getAttribute("aria-current")).toBe("true");
  });

  it("keeps working across projects listed while it is the selection", async () => {
    // The last project was forgotten, so one is left and all of them are selected.
    projects.set([eitri]);
    active.set(null);
    const { allEntry } = await render();

    expect(allEntry()).toBeDefined();
  });

  it("switches to every project at once", async () => {
    projects.set([other, eitri]);
    active.set(other);
    const { allEntry, chosen } = await render();

    allEntry()!.click();

    await vi.waitFor(() => expect(openAll).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(chosen).toHaveBeenCalledOnce());
    expect(open).not.toHaveBeenCalled();
  });

  it("removes an entry without leaving the dropdown or touching the folder", async () => {
    projects.set([other, eitri]);
    active.set(other);
    const { remove, chosen } = await render();

    expect(remove("eitri")).toBeDefined();
    remove("eitri")!.click();

    await vi.waitFor(() => expect(forget).toHaveBeenCalledExactlyOnceWith(eitri.path));
    // Tidying up is rarely one action, so the dropdown stays open.
    expect(chosen).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("narrows the list by name or path, so switching stays fast", async () => {
    projects.set([other, eitri]);
    const { element } = await render();
    const search = element.querySelector<HTMLInputElement>("input[data-slot=command-input]")!;
    // Filtered-out entries stay in the DOM and are hidden by `data-hidden`.
    const shown = () =>
      [...element.querySelectorAll("button[data-slot=command-item][title]")]
        .filter((item) => !item.hasAttribute("data-hidden"))
        .map((item) => item.querySelector("span")?.textContent);

    const type = async (text: string) => {
      search.value = text;
      search.dispatchEvent(new Event("input"));
      await Promise.resolve();
    };

    await type("eit");
    await vi.waitFor(() => expect(shown()).toEqual(["eitri"]));

    // The hidden path still matches, so a folder can be found by where it lives.
    await type("/git/other");
    await vi.waitFor(() => expect(shown()).toEqual(["other"]));

    await type("nothing-here");
    await vi.waitFor(() => expect(shown()).toEqual([]));
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

  it("explains an empty list instead of showing an empty search", async () => {
    const { element } = await render();

    expect(element.textContent).toContain("No projects yet");
    expect(element.querySelector("input[data-slot=command-input]")).toBeNull();
  });

  it("passes on why the last project did not open", async () => {
    notice.set("“eitri” is no longer at /git/eitri.");
    const { element } = await render();

    expect(element.querySelector('[role="status"]')?.textContent).toContain("no longer");
  });

  it("opens the folder the desktop picker returned", async () => {
    browse.mockResolvedValue("/git/picked");
    const { button, chosen } = await render();

    button("Open folder…")!.click();

    await vi.waitFor(() => expect(open).toHaveBeenCalledExactlyOnceWith("/git/picked"));
    await vi.waitFor(() => expect(chosen).toHaveBeenCalledOnce());
  });

  it("opens nothing when the desktop picker was dismissed", async () => {
    const { button, chosen } = await render();

    button("Open folder…")!.click();

    await vi.waitFor(() => expect(browse).toHaveBeenCalled());
    expect(open).not.toHaveBeenCalled();
    expect(chosen).not.toHaveBeenCalled();
  });

  it("asks the browser for a path, since it cannot browse the backend's folders", async () => {
    canBrowse = false;
    const { element } = await render();

    const field = element.querySelector<HTMLInputElement>("input[name=path]")!;
    expect(field.getAttribute("aria-label")).toBe("Project folder path on the server");
    // A pasted path often carries whitespace the backend would reject.
    field.value = "  /git/typed  ";
    element.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));

    await vi.waitFor(() => expect(open).toHaveBeenCalledExactlyOnceWith("/git/typed"));
  });

  it("offers to read the list again after it failed", async () => {
    error.set("Could not reach the project backend.");
    const { element, button } = await render();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain("Could not reach");
    button("Try again")!.click();

    expect(load).toHaveBeenCalledOnce();
  });

  it("holds actions while a request is still running", async () => {
    busy.set(true);
    error.set("Could not reach the project backend.");
    const { button } = await render();

    expect(button("Open folder…")?.disabled).toBe(true);
    expect(button("Try again")?.disabled).toBe(true);
  });
});
