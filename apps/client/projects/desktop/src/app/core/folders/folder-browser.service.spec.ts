import { TestBed } from "@angular/core/testing";
import { FOLDERS_ENDPOINT } from "@eitri/contracts/folder";
import { ClientService } from "@core/client/client.service";
import { FolderBrowserService } from "./folder-browser.service";

const listing = (path: string) => ({
  path,
  parentPath: path === "/" ? null : "/",
  directories: [{ name: "child", path: `${path}/child` }],
  truncated: false,
});

describe("FolderBrowserService", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let serverUrl = "";

  beforeEach(() => {
    serverUrl = "";
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    TestBed.configureTestingModule({
      providers: [
        FolderBrowserService,
        {
          provide: ClientService,
          useValue: { getServerUrl: () => Promise.resolve(serverUrl), selectDirectory: null },
        },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it("starts at server home without sending a path", async () => {
    fetchMock.mockResolvedValue(Response.json(listing("/home/chris")));
    const folders = TestBed.inject(FolderBrowserService);

    expect(await folders.navigate()).toBe(true);

    expect(folders.current()?.path).toBe("/home/chris");
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(FOLDERS_ENDPOINT, {
      signal: expect.any(AbortSignal),
    });
  });

  it("encodes an explicit server path against the runtime endpoint", async () => {
    serverUrl = "http://127.0.0.1:54321/";
    fetchMock.mockResolvedValue(Response.json(listing("/srv/space ü")));

    await TestBed.inject(FolderBrowserService).navigate("/srv/space ü");

    expect(fetchMock.mock.calls[0][0]).toBe(
      `http://127.0.0.1:54321${FOLDERS_ENDPOINT}?path=%2Fsrv%2Fspace+%C3%BC`,
    );
  });

  it("lets only the newest response update any state", async () => {
    const answers: ((response: Response) => void)[] = [];
    fetchMock.mockImplementation(() => new Promise((resolve) => answers.push(resolve)));
    const folders = TestBed.inject(FolderBrowserService);

    const first = folders.navigate("/first");
    const second = folders.navigate("/second");
    await vi.waitFor(() => expect(answers).toHaveLength(2));

    answers[1](Response.json(listing("/second")));
    await expect(second).resolves.toBe(true);
    expect(folders.current()?.path).toBe("/second");
    expect(folders.loading()).toBe(false);

    answers[0](Response.json(listing("/first"), { status: 500 }));
    await expect(first).resolves.toBe(false);
    expect(folders.current()?.path).toBe("/second");
    expect(folders.error()).toBeNull();
    expect(folders.loading()).toBe(false);
  });

  it("shows a backend refusal while retaining the last usable listing", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(listing("/good")));
    const folders = TestBed.inject(FolderBrowserService);
    await folders.navigate("/good");
    fetchMock.mockResolvedValueOnce(Response.json("“/gone” does not exist.", { status: 400 }));

    expect(await folders.navigate("/gone")).toBe(false);

    expect(folders.current()?.path).toBe("/good");
    expect(folders.error()).toBe("“/gone” does not exist.");
  });

  it("rejects a relative path before fetching", async () => {
    const folders = TestBed.inject(FolderBrowserService);

    expect(await folders.navigate("relative/path")).toBe(false);

    expect(folders.error()).toContain("absolute folder path");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
