import { TestBed } from "@angular/core/testing";
import { PROJECT_PATH_MESSAGE, PROJECTS_ENDPOINT } from "@eitri/contracts/project";
import { ClientService } from "@core/client/client.service";
import { ProjectService } from "./project.service";

const eitri = { path: "/git/eitri", name: "eitri", lastOpenedAt: "2026-09-21T10:00:00.000Z" };
const other = { path: "/git/other", name: "other", lastOpenedAt: "2026-09-20T10:00:00.000Z" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("ProjectService", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const selectDirectory = vi.fn<() => Promise<string | null>>();
  let serverUrl = "";

  const service = (picker: (() => Promise<string | null>) | null = selectDirectory) => {
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
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it("restores the project the user left off in", async () => {
    fetchMock.mockResolvedValue(
      json({ projects: [eitri, other], activePath: eitri.path, notice: null }),
    );
    const projects = service();

    await projects.load();

    expect(projects.active()).toEqual(eitri);
    expect(projects.projects()).toEqual([eitri, other]);
    expect(projects.notice()).toBeNull();
    expect(projects.error()).toBeNull();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(PROJECTS_ENDPOINT);
  });

  it("asks the desktop shell where the backend listens", async () => {
    serverUrl = "http://127.0.0.1:54321/";
    fetchMock.mockResolvedValue(json({ projects: [], activePath: null, notice: null }));

    await service().load();

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:54321/api/projects");
  });

  it("opens nothing, and says why, when the last project moved away", async () => {
    fetchMock.mockResolvedValue(
      json({ projects: [eitri], activePath: null, notice: "“eitri” is no longer at /git/eitri." }),
    );
    const projects = service();

    await projects.load();

    expect(projects.active()).toBeNull();
    expect(projects.notice()).toContain("no longer");
    // Still offered, so moving it back is one click away.
    expect(projects.projects()).toEqual([eitri]);
  });

  it("reads once and shares that result with later callers", async () => {
    fetchMock.mockResolvedValue(json({ projects: [], activePath: null, notice: null }));
    const projects = service();

    await Promise.all([projects.load(), projects.load()]);
    await projects.load();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lets the user try again after a read failed", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    const projects = service();

    await projects.load();
    expect(projects.error()).toContain("Could not reach the project backend");

    fetchMock.mockResolvedValue(json({ projects: [eitri], activePath: eitri.path, notice: null }));
    await projects.load();

    expect(projects.error()).toBeNull();
    expect(projects.active()).toEqual(eitri);
  });

  it("switches to another project and clears the earlier failure", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ projects: [eitri], activePath: eitri.path, notice: null }),
    );
    const projects = service();
    await projects.load();

    fetchMock.mockResolvedValueOnce(
      json({ projects: [other, eitri], activePath: other.path, notice: null }),
    );
    expect(await projects.open(other.path)).toBe(true);

    expect(projects.active()).toEqual(other);
    expect(projects.projects()).toEqual([other, eitri]);
    const [endpoint, init] = fetchMock.mock.calls[1];
    expect(endpoint).toBe(PROJECTS_ENDPOINT);
    expect(init).toMatchObject({ method: "POST", body: JSON.stringify({ path: other.path }) });
  });

  it("keeps the open project when a switch is refused", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ projects: [eitri], activePath: eitri.path, notice: null }),
    );
    const projects = service();
    await projects.load();

    fetchMock.mockResolvedValueOnce(json("“/git/gone” does not exist.", 400));
    expect(await projects.open("/git/gone")).toBe(false);

    expect(projects.active()).toEqual(eitri);
    expect(projects.error()).toBe("“/git/gone” does not exist.");
  });

  it("refuses a path the backend would refuse, without asking it", async () => {
    const projects = service();

    expect(await projects.open("relative/path")).toBe(false);

    expect(projects.error()).toBe(PROJECT_PATH_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("selects every project at once", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ projects: [eitri], activePath: eitri.path, notice: null }),
    );
    const projects = service();
    await projects.load();
    expect(projects.allSelected()).toBe(false);

    fetchMock.mockResolvedValueOnce(json({ projects: [eitri], activePath: null, notice: null }));
    expect(await projects.openAll()).toBe(true);

    expect(projects.allSelected()).toBe(true);
    expect(projects.active()).toBeNull();
    // Still listed, so narrowing back down stays one click away.
    expect(projects.projects()).toEqual([eitri]);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ path: null }),
    });
  });

  it("forgets an entry, keeping whatever the backend says is left", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ projects: [other, eitri], activePath: other.path, notice: null }),
    );
    const projects = service();
    await projects.load();

    fetchMock.mockResolvedValueOnce(json({ projects: [eitri], activePath: null, notice: null }));
    expect(await projects.forget(other.path)).toBe(true);

    expect(projects.projects()).toEqual([eitri]);
    expect(projects.allSelected()).toBe(true);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "DELETE",
      body: JSON.stringify({ path: other.path }),
    });
  });

  it("keeps the list when forgetting is refused", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ projects: [eitri], activePath: eitri.path, notice: null }),
    );
    const projects = service();
    await projects.load();

    fetchMock.mockResolvedValueOnce(json("“eitri” is not in the list.", 404));
    expect(await projects.forget(eitri.path)).toBe(false);

    expect(projects.projects()).toEqual([eitri]);
    expect(projects.error()).toBe("“eitri” is not in the list.");
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

  it("runs one request at a time, so a late answer cannot win", async () => {
    const answers: ((response: Response) => void)[] = [];
    fetchMock.mockImplementation(() => new Promise((resolve) => answers.push(resolve)));
    const projects = service();

    const reading = projects.load();
    expect(projects.busy()).toBe(true);
    // Refused while the read is still in flight, rather than queued behind it.
    expect(await projects.open(other.path)).toBe(false);
    expect(answers).toHaveLength(1);

    answers[0](json({ projects: [eitri], activePath: eitri.path, notice: null }));
    await reading;

    expect(projects.busy()).toBe(false);
    expect(projects.active()).toEqual(eitri);
  });

  it("opens what the platform picker returned", async () => {
    selectDirectory.mockResolvedValue("/git/picked");
    const projects = service();

    expect(await projects.browse()).toBe("/git/picked");
    expect(projects.canBrowse).toBe(true);
  });

  it.each([
    { what: "the user cancelled", picked: null },
    { what: "there is no picker", picked: undefined },
  ])("opens nothing when $what", async ({ picked }) => {
    selectDirectory.mockResolvedValue(null);
    const projects = service(picked === undefined ? null : selectDirectory);

    expect(await projects.browse()).toBeNull();
    expect(projects.canBrowse).toBe(picked === null);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
