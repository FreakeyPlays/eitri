import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { start } from "../test-utils/server.ts";

describe("origin guard", () => {
  let server: ReturnType<typeof start>;
  let dataDir: string;
  let health: string;

  beforeAll(async () => {
    // A throwaway directory; no test may reach the data of an installed Eitri.
    dataDir = await mkdtemp(join(tmpdir(), "eitri-http-"));
    server = start(dataDir);
    health = new URL("/health", await server.url).href;
  });

  afterAll(async () => {
    try {
      await server?.stop();
    } finally {
      if (dataDir) await rm(dataDir, { recursive: true, force: true });
    }
  });

  /** Bun lets a client pick Host and Origin, which a browser never would. */
  const get = (host: string, origin: string) =>
    fetch(health, { headers: { Host: host, Origin: origin } });

  it("answers a request without an Origin header", async () => {
    expect((await fetch(health)).status).toBe(200);
  });

  it.each(["localhost:4318", "127.0.0.1:4318", "[::1]:4318"])(
    "accepts a page served from its own origin on %s",
    async (host) => {
      expect((await get(host, `http://${host}`)).status).toBe(200);
    },
  );

  it.each([
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
  ])("accepts the configured client origin %s", async (origin) => {
    expect((await get("127.0.0.1:4318", origin)).status).toBe(200);
  });

  it("refuses a foreign origin with a short explanation", async () => {
    const response = await get("untrusted.example", "http://untrusted.example");

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Origin not allowed.");
  });

  it("refuses a localhost origin that is not the host being addressed", async () => {
    expect((await get("untrusted.example", "http://localhost:4318")).status).toBe(403);
  });

  it("refuses an origin that matches the host but cannot be parsed", async () => {
    expect((await get("[", "http://[")).status).toBe(403);
  });
});
