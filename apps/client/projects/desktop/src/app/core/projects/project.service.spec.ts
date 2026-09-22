import { TestBed } from "@angular/core/testing";
import { PROJECT_PATH_MESSAGE } from "@eitri/contracts/project";
import { ClientService } from "@core/client/client.service";
import { ServerService } from "@core/server/server.service";
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

  it("loads the collection with all projects selected", async () => {
    call.mockResolvedValue({ projects: [eitri, other] });
    const projects = service();

    await projects.load();

    expect(projects.projects()).toEqual([eitri, other]);
    expect(projects.active()).toBeNull();
    expect(projects.allSelected()).toBe(true);
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

  it("selects all projects locally without a server call", async () => {
    call.mockResolvedValueOnce({ projects: [eitri], openedProjectId: eitri.id });
    const projects = service();
    await projects.open(eitri.path);

    expect(projects.openAll()).toBe(true);

    expect(projects.allSelected()).toBe(true);
    expect(projects.projects()).toEqual([eitri]);
    expect(call).toHaveBeenCalledOnce();
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

  it("forgets by ID and clears selection when the returned collection lacks it", async () => {
    call
      .mockResolvedValueOnce({ projects: [other, eitri], openedProjectId: other.id })
      .mockResolvedValueOnce({ projects: [eitri] });
    const projects = service();
    await projects.open(other.path);

    expect(await projects.forget(other.id)).toBe(true);

    expect(projects.projects()).toEqual([eitri]);
    expect(projects.allSelected()).toBe(true);
    expect(call).toHaveBeenLastCalledWith("projects.forget", { id: other.id });
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
    expect(projects.openAll()).toBe(false);
    answer({ projects: [eitri] });
    await loading;

    expect(projects.busy()).toBe(false);
    expect(projects.allSelected()).toBe(true);
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
