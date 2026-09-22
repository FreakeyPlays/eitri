import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as BunServices from "@effect/platform-bun/BunServices";
import { FOLDER_PATH_MESSAGE, FOLDERS_ENDPOINT } from "@eitri/contracts/folder";
import { Console, Effect, Fiber } from "effect";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { runServer } from "./server.ts";

const start = (dataDir: string) => {
  const announced: string[] = [];
  const recorder: Console.Console = Object.assign(Object.create(console), {
    log: (...args: ReadonlyArray<unknown>) => announced.push(args.join(" ")),
  });
  const fiber = Effect.runFork(
    runServer({ port: 0, sidecar: false, dataDir }).pipe(
      Effect.provideService(Console.Console, recorder),
      Effect.provide(BunServices.layer),
    ),
  );
  const url = (async () => {
    const deadline = Date.now() + 5_000;
    while (announced.length === 0) {
      if (Date.now() > deadline) throw new Error("Server never announced its address.");
      await Bun.sleep(5);
    }
    const match = /listening on (http:\/\/[^\s]+)/.exec(announced[0]);
    if (!match) throw new Error(`Unexpected announcement: ${announced[0]}`);
    return match[1];
  })();
  return { url, stop: () => Effect.runPromise(Fiber.interrupt(fiber)) };
};

describe("folder browser HTTP route", () => {
  let dataDir: string;
  let folder: string;
  let server: ReturnType<typeof start>;
  let url: string;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "eitri-folder-http-data-"));
    folder = await realpath(await mkdtemp(join(tmpdir(), "eitri-folder-http-")));
    await Promise.all([mkdir(join(folder, "zeta")), mkdir(join(folder, "space ü"))]);
    server = start(dataDir);
    url = await server.url;
  });

  afterAll(async () => {
    try {
      await server?.stop();
    } finally {
      if (dataDir) await rm(dataDir, { recursive: true, force: true });
      if (folder) await rm(folder, { recursive: true, force: true });
    }
  });

  const endpoint = (path?: string) => {
    const target = new URL(FOLDERS_ENDPOINT, url);
    if (path !== undefined) target.search = new URLSearchParams({ path }).toString();
    return target;
  };

  it("returns an encoded explicit path through the shared response contract", async () => {
    const response = await fetch(endpoint(folder));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      path: folder,
      directories: [
        { name: "space ü", path: join(folder, "space ü") },
        { name: "zeta", path: join(folder, "zeta") },
      ],
      truncated: false,
    });
  });

  it("rejects an invalid path before filesystem access", async () => {
    const response = await fetch(endpoint("relative/path"));

    expect(response.status).toBe(400);
    expect(await response.json()).toContain(FOLDER_PATH_MESSAGE);
  });

  it("advertises its read-only method", async () => {
    const preflight = await fetch(endpoint(folder), {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:1420" },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Methods")).toBe("GET");

    const refused = await fetch(endpoint(folder), { method: "POST" });
    expect(refused.status).toBe(405);
    expect(refused.headers.get("Allow")).toBe("GET");
  });
});
