import { TestBed } from "@angular/core/testing";
import { FOLDERS_ENDPOINT } from "@eitri/contracts/folder";
import { PROJECT_PATH_MESSAGE, PROJECTS_ENDPOINT } from "@eitri/contracts/project";
import { ClientService } from "@core/client/client.service";
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
const webSelectionKey = "eitri.project-selection:http://localhost:3000";
const desktopSelectionKey = "eitri.project-selection:desktop-local";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("ProjectService", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const selectDirectory = vi.fn<() => Promise<string | null>>();
  let serverUrl = "";

  const service = (picker: (() => Promise<string | null>) | null = null) => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ClientService,
          useValue: { getServerUrl: () => Promise.resolve(serverUrl), selectDirectory: picker },
        },
      ],
    });
    return TestBed.inject(ProjectService);
  };

  beforeEach(() => {
    serverUrl = "";
    fetchMock.mockReset();
    selectDirectory.mockReset();
    localStorage.clear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it("loads the collection with all projects selected when nothing was remembered", async () => {
    fetchMock.mockResolvedValue(json({ projects: [eitri, other] }));
    const projects = service();

    await projects.load();

    expect(projects.projects()).toEqual([eitri, other]);
    expect(projects.active()).toBeNull();
    expect(projects.allSelected()).toBe(true);
    expect(projects.notice()).toBeNull();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(PROJECTS_ENDPOINT, {});
  });

  it("restores the locally selected project and counts that as opening it", async () => {
    localStorage.setItem(webSelectionKey, eitri.id);
    fetchMock
      .mockResolvedValueOnce(json({ projects: [eitri, other] }))
      .mockResolvedValueOnce(json({ projects: [eitri, other], openedProjectId: eitri.id }));
    const projects = service();

    await projects.load();

    expect(projects.active()).toEqual(eitri);
    expect(fetchMock.mock.calls).toEqual([
      [PROJECTS_ENDPOINT, {}],
      [
        PROJECTS_ENDPOINT,
        expect.objectContaining({ method: "POST", body: JSON.stringify({ path: eitri.path }) }),
      ],
    ]);
  });

  it("uses one stable desktop selection key across ephemeral backend ports", async () => {
    localStorage.setItem(desktopSelectionKey, eitri.id);
    serverUrl = "http://127.0.0.1:54321/";
    fetchMock
      .mockResolvedValueOnce(json({ projects: [eitri] }))
      .mockResolvedValueOnce(json({ projects: [eitri], openedProjectId: eitri.id }));

    await service(selectDirectory).load();

    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:54321/api/projects");
    expect(fetchMock.mock.calls[1][0]).toBe("http://127.0.0.1:54321/api/projects");
    expect(localStorage.getItem(desktopSelectionKey)).toBe(eitri.id);
    expect(localStorage.getItem(`eitri.project-selection:${serverUrl}`)).toBeNull();
  });

  it("falls back clearly when the remembered ID is no longer in the collection", async () => {
    localStorage.setItem(webSelectionKey, eitri.id);
    fetchMock.mockResolvedValue(json({ projects: [other] }));
    const projects = service();

    await projects.load();

    expect(projects.active()).toBeNull();
    expect(projects.projects()).toEqual([other]);
    expect(projects.notice()).toContain("no longer in the list");
    expect(localStorage.getItem(webSelectionKey)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps an unavailable project listed while falling back to all projects", async () => {
    localStorage.setItem(webSelectionKey, eitri.id);
    fetchMock
      .mockResolvedValueOnce(json({ projects: [eitri] }))
      .mockResolvedValueOnce(json("“/git/eitri” is not a folder.", 400));
    const projects = service();

    await projects.load();

    expect(projects.active()).toBeNull();
    expect(projects.projects()).toEqual([eitri]);
    expect(projects.notice()).toBe("“/git/eitri” is not a folder. Showing all projects.");
    expect(projects.error()).toBeNull();
    expect(localStorage.getItem(webSelectionKey)).toBeNull();
  });

  it("reads once and shares that result with later callers", async () => {
    fetchMock.mockResolvedValue(json({ projects: [] }));
    const projects = service();

    await Promise.all([projects.load(), projects.load()]);
    await projects.load();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lets the user retry after the initial read failed", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    const projects = service();

    await projects.load();
    expect(projects.error()).toContain("Could not reach the Eitri server");
    expect(projects.loaded()).toBe(false);

    fetchMock.mockResolvedValue(json({ projects: [eitri] }));
    await projects.load();

    expect(projects.error()).toBeNull();
    expect(projects.loaded()).toBe(true);
    expect(projects.projects()).toEqual([eitri]);
  });

  it("switches by path but tracks the opened project by returned ID", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ projects: [eitri] }))
      .mockResolvedValueOnce(json({ projects: [other, eitri], openedProjectId: other.id }));
    const projects = service();
    await projects.load();

    expect(await projects.open(other.path)).toBe(true);

    expect(projects.active()).toEqual(other);
    expect(localStorage.getItem(webSelectionKey)).toBe(other.id);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ path: other.path }),
    });
  });

  it("keeps the current selection when opening another path is refused", async () => {
    localStorage.setItem(webSelectionKey, eitri.id);
    fetchMock
      .mockResolvedValueOnce(json({ projects: [eitri] }))
      .mockResolvedValueOnce(json({ projects: [eitri], openedProjectId: eitri.id }))
      .mockResolvedValueOnce(json("“/git/gone” does not exist.", 400));
    const projects = service();
    await projects.load();

    expect(await projects.open("/git/gone")).toBe(false);

    expect(projects.active()).toEqual(eitri);
    expect(projects.error()).toBe("“/git/gone” does not exist.");
    expect(localStorage.getItem(webSelectionKey)).toBe(eitri.id);
  });

  it("keeps the current selection when an open reply identifies an absent project", async () => {
    localStorage.setItem(webSelectionKey, eitri.id);
    fetchMock
      .mockResolvedValueOnce(json({ projects: [eitri] }))
      .mockResolvedValueOnce(json({ projects: [eitri], openedProjectId: eitri.id }))
      .mockResolvedValueOnce(json({ projects: [eitri], openedProjectId: other.id }));
    const projects = service();
    await projects.load();

    expect(await projects.open(other.path)).toBe(false);

    expect(projects.active()).toEqual(eitri);
    expect(projects.projects()).toEqual([eitri]);
    expect(projects.error()).toBe("Unexpected response from the project backend.");
    expect(localStorage.getItem(webSelectionKey)).toBe(eitri.id);
  });

  it("refuses a relative path without asking the backend", async () => {
    const projects = service();

    expect(await projects.open("relative/path")).toBe(false);

    expect(projects.error()).toBe(PROJECT_PATH_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("selects all projects locally without a server write", async () => {
    localStorage.setItem(webSelectionKey, eitri.id);
    fetchMock
      .mockResolvedValueOnce(json({ projects: [eitri] }))
      .mockResolvedValueOnce(json({ projects: [eitri], openedProjectId: eitri.id }));
    const projects = service();
    await projects.load();

    expect(projects.openAll()).toBe(true);

    expect(projects.allSelected()).toBe(true);
    expect(projects.projects()).toEqual([eitri]);
    expect(localStorage.getItem(webSelectionKey)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not let another tab's storage change replace the live selection", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ projects: [eitri, other] }))
      .mockResolvedValueOnce(json({ projects: [other, eitri], openedProjectId: other.id }));
    const projects = service();
    await projects.load();
    await projects.open(other.path);

    localStorage.setItem(webSelectionKey, eitri.id);
    globalThis.dispatchEvent(
      new StorageEvent("storage", { key: webSelectionKey, newValue: eitri.id }),
    );

    expect(projects.active()).toEqual(other);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("forgets by ID and clears selection when the returned collection lacks it", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ projects: [eitri, other] }))
      .mockResolvedValueOnce(json({ projects: [other, eitri], openedProjectId: other.id }))
      .mockResolvedValueOnce(json({ projects: [] }));
    const projects = service();
    await projects.load();
    await projects.open(other.path);

    expect(await projects.forget(eitri.id)).toBe(true);

    expect(projects.projects()).toEqual([]);
    expect(projects.allSelected()).toBe(true);
    expect(localStorage.getItem(webSelectionKey)).toBeNull();
    expect(fetchMock.mock.calls[2][1]).toMatchObject({
      method: "DELETE",
      body: JSON.stringify({ id: eitri.id }),
    });
  });

  it("keeps the collection when forgetting is refused", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ projects: [eitri] }))
      .mockResolvedValueOnce(json("“eitri” is not in the list.", 404));
    const projects = service();
    await projects.load();

    expect(await projects.forget(eitri.id)).toBe(false);

    expect(projects.projects()).toEqual([eitri]);
    expect(projects.error()).toBe("“eitri” is not in the list.");
  });

  it("keeps project use working when local storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    fetchMock
      .mockResolvedValueOnce(json({ projects: [eitri] }))
      .mockResolvedValueOnce(json({ projects: [eitri], openedProjectId: eitri.id }));
    const projects = service();

    await projects.load();
    expect(await projects.open(eitri.path)).toBe(true);

    expect(projects.active()).toEqual(eitri);
    expect(projects.error()).toBeNull();
  });

  it.each([
    { what: "an unreachable backend", reply: () => Promise.reject(new TypeError("offline")) },
    { what: "a page instead of an answer", reply: () => new Response("<html>", { status: 502 }) },
    { what: "an unexpected payload", reply: () => json({ unexpected: true }) },
  ])("reports $what instead of pretending", async ({ reply }) => {
    fetchMock.mockImplementation(async () => reply());
    const projects = service();

    await projects.load();

    expect(projects.error()).not.toBeNull();
    expect(projects.active()).toBeNull();
  });

  it("keeps restore busy until local selection has been resolved", async () => {
    localStorage.setItem(webSelectionKey, eitri.id);
    let answerGet!: (response: Response) => void;
    let answerOpen!: (response: Response) => void;
    fetchMock
      .mockImplementationOnce(() => new Promise((resolve) => (answerGet = resolve)))
      .mockImplementationOnce(() => new Promise((resolve) => (answerOpen = resolve)));
    const projects = service();

    const restoring = projects.load();
    expect(projects.busy()).toBe(true);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    answerGet(json({ projects: [eitri] }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(projects.busy()).toBe(true);
    expect(await projects.open(other.path)).toBe(false);
    expect(projects.openAll()).toBe(false);
    answerOpen(json({ projects: [eitri], openedProjectId: eitri.id }));
    await restoring;

    expect(projects.busy()).toBe(false);
    expect(projects.active()).toEqual(eitri);
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("listFolders", () => {
    const listing = (path: string) => ({
      path,
      parentPath: path === "/" ? null : "/",
      directories: [{ name: "child", path: `${path}/child` }],
      truncated: false,
    });

    it("starts at server home without sending a path", async () => {
      fetchMock.mockResolvedValue(json(listing("/home/chris")));

      expect((await service().listFolders()).path).toBe("/home/chris");
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(FOLDERS_ENDPOINT, {
        signal: expect.any(AbortSignal),
      });
    });

    it("encodes an explicit server path against the runtime endpoint", async () => {
      serverUrl = "http://127.0.0.1:54321/";
      fetchMock.mockResolvedValue(json(listing("/srv/space ü")));

      await service().listFolders("/srv/space ü");

      expect(fetchMock.mock.calls[0][0]).toBe(
        `http://127.0.0.1:54321${FOLDERS_ENDPOINT}?path=%2Fsrv%2Fspace+%C3%BC`,
      );
    });

    it("throws the backend's refusal without touching project state", async () => {
      fetchMock.mockResolvedValue(json("“/gone” does not exist.", 400));
      const projects = service();

      await expect(projects.listFolders("/gone")).rejects.toThrow("“/gone” does not exist.");
      expect(projects.error()).toBeNull();
      expect(projects.busy()).toBe(false);
    });

    it("rejects a relative path before fetching", async () => {
      await expect(service().listFolders("relative/path")).rejects.toThrow("absolute folder path");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
