import { TestBed } from "@angular/core/testing";
import { PROJECT_PATH_MESSAGE } from "@eitri/contracts/project";
import { ClientService } from "@core/platform/client.service";
import { ServerService } from "@core/connection/server.service";
import { ProjectService } from "./project.service";

const eitri = {
  id: "ca0dcace-34da-4b44-8364-13ce54a32e44",
  path: "/git/eitri",
  name: "eitri",
  lastOpenedAt: "2026-09-21T10:00:00.000Z",
};
const other = {
  id: "f03411f4-d917-49da-b10b-4e2c5cb1fb1c",
  path: "/git/other",
  name: "other",
  lastOpenedAt: "2026-09-20T10:00:00.000Z",
};
const third = {
  ...eitri,
  id: "32b31fe2-7130-44d4-9069-b81909b31e98",
  path: "/git/third",
  name: "third",
};

describe("ProjectService", () => {
  const call = vi.fn<(tag: string, payload?: unknown) => Promise<unknown>>();
  const selectDirectory = vi.fn<() => Promise<string | null>>();

  const service = (picker: (() => Promise<string | null>) | null = null) => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ClientService,
          useValue: { getServerUrl: async () => "", selectDirectory: picker },
        },
        { provide: ServerService, useValue: { call } },
      ],
    });
    return TestBed.inject(ProjectService);
  };

  beforeEach(() => {
    call.mockReset();
    selectDirectory.mockReset();
  });

  afterEach(() => TestBed.resetTestingModule());

  it("loads the collection and selects the most recently opened project", async () => {
    call.mockResolvedValue({ projects: [eitri, other] });
    const projects = service();

    await projects.load();

    expect(projects.projects()).toEqual([eitri, other]);
    expect(projects.active()).toEqual(eitri);
    expect(call).toHaveBeenCalledExactlyOnceWith("projects.list");
  });

  it("reads once and shares that result with later callers", async () => {
    call.mockResolvedValue({ projects: [] });
    const projects = service();

    await Promise.all([projects.load(), projects.load()]);
    await projects.load();

    expect(call).toHaveBeenCalledTimes(1);
  });

  it("lets the user retry after the initial read failed", async () => {
    call.mockRejectedValueOnce(new Error("Could not reach the Eitri server."));
    const projects = service();

    await projects.load();
    expect(projects.error()).toContain("Could not reach the Eitri server");
    expect(projects.loaded()).toBe(false);

    call.mockResolvedValue({ projects: [eitri] });
    await projects.load();

    expect(projects.error()).toBeNull();
    expect(projects.loaded()).toBe(true);
    expect(projects.projects()).toEqual([eitri]);
  });

  it("switches by path but tracks the opened project by returned ID", async () => {
    call.mockResolvedValue({ projects: [other, eitri], openedProjectId: other.id });
    const projects = service();

    expect(await projects.open(other.path)).toBe(true);

    expect(projects.active()).toEqual(other);
    expect(call).toHaveBeenCalledExactlyOnceWith("projects.open", { path: other.path });
  });

  it("keeps the current selection when opening another path is refused", async () => {
    call
      .mockResolvedValueOnce({ projects: [eitri], openedProjectId: eitri.id })
      .mockRejectedValueOnce(new Error("“/git/gone” does not exist."));
    const projects = service();
    await projects.open(eitri.path);

    expect(await projects.open("/git/gone")).toBe(false);

    expect(projects.active()).toEqual(eitri);
    expect(projects.error()).toBe("“/git/gone” does not exist.");
  });

  it("refuses a relative path without asking the server", async () => {
    const projects = service();

    expect(await projects.open("relative/path")).toBe(false);

    expect(projects.error()).toBe(PROJECT_PATH_MESSAGE);
    expect(call).not.toHaveBeenCalled();
  });

  it("has no active project when the collection is empty", async () => {
    call.mockResolvedValue({ projects: [] });
    const projects = service();

    await projects.load();

    expect(projects.projects()).toEqual([]);
    expect(projects.active()).toBeNull();
    expect(projects.loaded()).toBe(true);
    expect(call).toHaveBeenCalledExactlyOnceWith("projects.list");
  });

  it("renames by ID with a trimmed name", async () => {
    call.mockResolvedValue({ projects: [{ ...eitri, name: "Client portal" }] });
    const projects = service();

    expect(await projects.rename(eitri.id, "  Client portal ")).toBe(true);

    expect(projects.projects()[0]?.name).toBe("Client portal");
    expect(call).toHaveBeenCalledExactlyOnceWith("projects.rename", {
      id: eitri.id,
      name: "Client portal",
    });
  });

  it("forgets by ID and selects the first remaining project when the active one is removed", async () => {
    call
      .mockResolvedValueOnce({ projects: [other, third, eitri], openedProjectId: other.id })
      .mockResolvedValueOnce({ projects: [third, eitri] });
    const projects = service();
    await projects.open(other.path);

    expect(await projects.forget(other.id)).toBe(true);

    expect(projects.projects()).toEqual([third, eitri]);
    expect(projects.active()).toEqual(third);
    expect(call).toHaveBeenCalledTimes(2);
    expect(call).toHaveBeenLastCalledWith("projects.forget", { id: other.id });
  });

  it("preserves the active project when another project is forgotten", async () => {
    call
      .mockResolvedValueOnce({ projects: [other, third, eitri], openedProjectId: eitri.id })
      .mockResolvedValueOnce({ projects: [third, eitri] });
    const projects = service();
    await projects.open(eitri.path);

    expect(await projects.forget(other.id)).toBe(true);

    expect(projects.projects()).toEqual([third, eitri]);
    expect(projects.active()).toEqual(eitri);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("clears selection when the last project is forgotten", async () => {
    call
      .mockResolvedValueOnce({ projects: [eitri], openedProjectId: eitri.id })
      .mockResolvedValueOnce({ projects: [] });
    const projects = service();
    await projects.open(eitri.path);

    expect(await projects.forget(eitri.id)).toBe(true);

    expect(projects.projects()).toEqual([]);
    expect(projects.active()).toBeNull();
  });

  it("keeps the collection when forgetting is refused", async () => {
    call
      .mockResolvedValueOnce({ projects: [eitri] })
      .mockRejectedValueOnce(new Error("That project is not in the list."));
    const projects = service();
    await projects.load();

    expect(await projects.forget(eitri.id)).toBe(false);

    expect(projects.projects()).toEqual([eitri]);
    expect(projects.error()).toBe("That project is not in the list.");
  });

  it("refuses user actions while the collection is still loading", async () => {
    let answer!: (snapshot: unknown) => void;
    call.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    const projects = service();

    const loading = projects.load();
    expect(projects.busy()).toBe(true);
    expect(await projects.open(other.path)).toBe(false);
    expect(await projects.forget(eitri.id)).toBe(false);
    answer({ projects: [eitri] });
    await loading;

    expect(projects.busy()).toBe(false);
    expect(projects.active()).toEqual(eitri);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("returns what the platform picker chose", async () => {
    selectDirectory.mockResolvedValue("/git/picked");
    const projects = service(selectDirectory);

    expect(await projects.pickFolder()).toBe("/git/picked");
    expect(projects.canPickFolder).toBe(true);
  });

  it.each([
    { what: "the user cancelled", picker: selectDirectory },
    { what: "there is no picker", picker: null },
  ])("opens nothing when $what", async ({ picker }) => {
    selectDirectory.mockResolvedValue(null);
    const projects = service(picker);

    expect(await projects.pickFolder()).toBeNull();
    expect(projects.canPickFolder).toBe(picker !== null);
    expect(call).not.toHaveBeenCalled();
  });

  describe("listFolders", () => {
    const listing = {
      path: "/home/chris",
      directories: [{ name: "child", path: "/home/chris/child" }],
      truncated: false,
    };

    it("starts at server home without sending a path", async () => {
      call.mockResolvedValue(listing);

      expect(await service().listFolders()).toEqual(listing);
      expect(call).toHaveBeenCalledExactlyOnceWith("folders.browse", {});
    });

    it("passes the server's refusal on without touching project state", async () => {
      call.mockRejectedValue(new Error("“/gone” does not exist."));
      const projects = service();

      await expect(projects.listFolders("/gone")).rejects.toThrow("“/gone” does not exist.");
      expect(projects.error()).toBeNull();
      expect(projects.busy()).toBe(false);
    });

    it("rejects a relative path before calling the server", async () => {
      await expect(service().listFolders("relative/path")).rejects.toThrow("absolute folder path");
      expect(call).not.toHaveBeenCalled();
    });
  });
});
