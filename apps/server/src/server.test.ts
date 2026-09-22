import { chmod, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, delimiter, join } from "node:path";
import * as BunServices from "@effect/platform-bun/BunServices";
import { AGENT_ENDPOINT, PROMPT_MAX_BYTES, PROMPT_RANGE_MESSAGE } from "@eitri/contracts/agent";
import {
  PROJECT_NAME_MESSAGE,
  PROJECT_PATH_MESSAGE,
  PROJECTS_ENDPOINT,
} from "@eitri/contracts/project";
import { Console, Effect, Fiber } from "effect";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { runServer } from "./server.ts";

/**
 * Boots the real server on an ephemeral port; bin.test.ts covers executable lifecycle behavior.
 */
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
    const deadline = Date.now() + 5000;
    while (announced.length === 0) {
      if (Date.now() > deadline) throw new Error("Server never announced its address.");
      await Bun.sleep(5);
    }
    const line = announced[0];
    const match = /listening on (http:\/\/[^\s]+)/.exec(line);
    if (!match) throw new Error(`Unexpected announcement: ${line}`);
    return match[1];
  })();

  return {
    url,
    announced,
    stop: () => Effect.runPromise(Fiber.interrupt(fiber)),
  };
};

/** Installs deterministic stand-ins for the agent CLIs; tests never invoke a real agent. */
const installAgents = async () => {
  const directory = await mkdtemp(join(tmpdir(), "eitri-server-"));
  await Bun.write(
    join(directory, "codex"),
    `#!/usr/bin/env bun
const prompt = await Bun.stdin.text();
console.log(prompt);
`,
  );
  await chmod(join(directory, "codex"), 0o755);
  await Bun.write(join(directory, "claude"), '#!/bin/sh\nprintf "login required" >&2\nexit 7\n');
  await chmod(join(directory, "claude"), 0o755);
  const path = process.env["PATH"];
  process.env["PATH"] = `${directory}${delimiter}${path}`;
  return {
    uninstall: async () => {
      if (path === undefined) delete process.env["PATH"];
      else process.env["PATH"] = path;
      await rm(directory, { recursive: true, force: true });
    },
  };
};

describe("HTTP routes", () => {
  let agents: Awaited<ReturnType<typeof installAgents>>;
  let server: ReturnType<typeof start>;
  let dataDir: string;
  let url: string;

  beforeAll(async () => {
    agents = await installAgents();
    // A throwaway directory; no test may reach the data of an installed Eitri.
    dataDir = await mkdtemp(join(tmpdir(), "eitri-data-"));
    server = start(dataDir);
    url = await server.url;
  });

  afterAll(async () => {
    try {
      await server?.stop();
    } finally {
      await agents?.uninstall();
      if (dataDir) await rm(dataDir, { recursive: true, force: true });
    }
  });

  const post = (body: string, headers: Record<string, string> = {}) =>
    fetch(new URL(AGENT_ENDPOINT, url), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body,
    });

  it("announces the address it listens on", () => {
    expect(server.announced[0]).toMatch(/^Server listening on http:\/\/127\.0\.0\.1:\d+\/?$/);
    expect(new URL(url).hostname).toBe("127.0.0.1");
  });

  it("serves the shared request and answer contract", async () => {
    const prompt = "--help\n$(literal) ä";
    const response = await post(JSON.stringify({ agent: "codex", prompt }));
    expect(response.status).toBe(200);
    expect(await response.json()).toBe(prompt);
  });

  it("answers health checks", async () => {
    const response = await fetch(new URL("/health", url));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it.each([" ", "ä".repeat(8001)])(
    "rejects invalid input through the shared schema",
    async (prompt) => {
      const response = await post(JSON.stringify({ agent: "codex", prompt }));
      expect(response.status).toBe(400);
      expect(await response.json()).toBe(PROMPT_RANGE_MESSAGE);
    },
  );

  it("reports a failing CLI as a single-line answer", async () => {
    const response = await post(JSON.stringify({ agent: "claude", prompt: "Hello" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toBe("Agent exited with 7: login required");
  });

  it("survives a CLI exiting before reading a large prompt", async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await post(JSON.stringify({ agent: "claude", prompt: "x".repeat(12_000) }));
      expect(await response.json()).toContain("Agent exited with 7: login required");
      expect((await fetch(new URL("/health", url))).status).toBe(200);
    }
    expect(
      await (await post(JSON.stringify({ agent: "codex", prompt: "still running" }))).json(),
    ).toBe("still running");
  });

  it("rejects oversized request bodies", async () => {
    const response = await post(" ".repeat(PROMPT_MAX_BYTES * 6 + 1025));
    expect(response.status).toBe(413);
  });

  it("rejects malformed JSON and unknown agents", async () => {
    for (const body of ["{", JSON.stringify({ agent: "unknown", prompt: "Hello" })]) {
      const response = await post(body);
      expect(response.status).toBe(400);
      expect(typeof (await response.json())).toBe("string");
    }
  });

  it("distinguishes unknown routes and unsupported methods", async () => {
    expect((await fetch(new URL("/missing", url))).status).toBe(404);
    for (const method of ["GET", "HEAD", "PUT", "PATCH", "DELETE"]) {
      const response = await fetch(new URL(`${AGENT_ENDPOINT}?source=test`, url), { method });
      expect(response.status).toBe(405);
      expect(response.headers.get("Allow")).toBe("POST");
    }
  });

  describe("projects", () => {
    const projects = () => new URL(PROJECTS_ENDPOINT, url);
    const mutateProject = (
      method: "POST" | "PATCH" | "DELETE",
      body: string,
      headers: Record<string, string> = {},
    ) =>
      fetch(new URL(PROJECTS_ENDPOINT, url), {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body,
      });
    const openProject = (body: string, headers: Record<string, string> = {}) =>
      mutateProject("POST", body, headers);
    const snapshot = () => fetch(new URL(PROJECTS_ENDPOINT, url)).then((res) => res.json());

    it("starts empty, then remembers what the user opened", async () => {
      expect(await snapshot()).toEqual({ projects: [] });

      const directory = await realpath(await mkdtemp(join(tmpdir(), "eitri-project-")));
      try {
        const response = await openProject(JSON.stringify({ path: directory }));
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
          projects: [
            {
              id: expect.any(String),
              path: directory,
              name: basename(directory),
              lastOpenedAt: expect.any(String),
            },
          ],
          openedProjectId: expect.any(String),
        });
        expect(await snapshot()).toMatchObject({ projects: [{ path: directory }] });
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });

    it.each([
      { body: JSON.stringify({ path: "relative/path" }), expected: PROJECT_PATH_MESSAGE },
      { body: JSON.stringify({ path: "/nope/missing" }), expected: "does not exist" },
      { body: "{", expected: "JSON" },
    ])("refuses $body with a message the picker can show", async ({ body, expected }) => {
      const response = await openProject(body);
      expect(response.status).toBe(400);
      expect(await response.json()).toContain(expected);
    });

    it("refuses a file that is not a folder", async () => {
      const directory = await realpath(await mkdtemp(join(tmpdir(), "eitri-file-")));
      const file = join(directory, "README.md");
      await Bun.write(file, "not a project");
      try {
        const response = await openProject(JSON.stringify({ path: file }));
        expect(response.status).toBe(400);
        expect(await response.json()).toContain("is not a folder");
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });

    it("reads and writes, and refuses everything else", async () => {
      const preflight = await fetch(projects(), {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:1420" },
      });
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get("Access-Control-Allow-Methods")).toBe(
        "GET, POST, PATCH, DELETE",
      );

      for (const method of ["PUT", "HEAD"]) {
        const response = await fetch(projects(), { method });
        expect(response.status).toBe(405);
        expect(response.headers.get("Allow")).toBe("GET, POST, PATCH, DELETE");
      }
    });

    it("renames a project by ID, clears it, and refuses an unusable name", async () => {
      const directory = await realpath(await mkdtemp(join(tmpdir(), "eitri-named-")));
      try {
        const opened = (await (await openProject(JSON.stringify({ path: directory }))).json()) as {
          openedProjectId: string;
        };
        const renamed = await mutateProject(
          "PATCH",
          JSON.stringify({ id: opened.openedProjectId, name: "Client portal" }),
        );
        expect(renamed.status).toBe(200);
        expect(await renamed.json()).toMatchObject({
          projects: expect.arrayContaining([
            expect.objectContaining({
              id: opened.openedProjectId,
              path: directory,
              name: "Client portal",
            }),
          ]),
        });

        const cleared = await mutateProject(
          "PATCH",
          JSON.stringify({ id: opened.openedProjectId, name: "" }),
        );
        expect(cleared.status).toBe(200);
        expect(await cleared.json()).toMatchObject({
          projects: expect.arrayContaining([
            expect.objectContaining({
              id: opened.openedProjectId,
              name: basename(directory),
            }),
          ]),
        });

        const refused = await mutateProject(
          "PATCH",
          JSON.stringify({ id: opened.openedProjectId, name: "  padded  " }),
        );
        expect(refused.status).toBe(400);
        expect(await refused.json()).toContain(PROJECT_NAME_MESSAGE);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });

    it("relocates and forgets a project by ID", async () => {
      const directory = await realpath(await mkdtemp(join(tmpdir(), "eitri-known-")));
      const moved = await realpath(await mkdtemp(join(tmpdir(), "eitri-moved-")));
      try {
        const opened = (await (await openProject(JSON.stringify({ path: directory }))).json()) as {
          openedProjectId: string;
        };
        const relocated = await mutateProject(
          "PATCH",
          JSON.stringify({ id: opened.openedProjectId, path: moved }),
        );
        expect(relocated.status).toBe(200);
        expect(await relocated.json()).toMatchObject({
          projects: expect.arrayContaining([
            expect.objectContaining({
              id: opened.openedProjectId,
              path: moved,
              name: basename(moved),
            }),
          ]),
        });

        const forgotten = await mutateProject(
          "DELETE",
          JSON.stringify({ id: opened.openedProjectId }),
        );
        expect(forgotten.status).toBe(200);
        const { projects: remaining } = (await forgotten.json()) as {
          projects: { id: string }[];
        };
        expect(remaining.map((project) => project.id)).not.toContain(opened.openedProjectId);
      } finally {
        await rm(directory, { recursive: true, force: true });
        await rm(moved, { recursive: true, force: true });
      }
    });

    it("refuses a foreign origin before reading any data", async () => {
      const response = await fetch(projects(), {
        headers: { Origin: "https://untrusted.example" },
      });
      expect(response.status).toBe(403);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });
  });

  it.each([
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
  ])("allows JSON requests from %s", async (origin) => {
    const endpoint = new URL(AGENT_ENDPOINT, url);
    const preflight = await fetch(endpoint, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(preflight.headers.get("Access-Control-Allow-Methods")).toBe("POST");
    expect(preflight.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
    for (const prompt of ["Hello", " "]) {
      const response = await post(JSON.stringify({ agent: "codex", prompt }), { Origin: origin });
      expect(response.status).toBe(prompt.trim() ? 200 : 400);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
      expect(response.headers.get("Vary")).toBe("Origin");
    }
  });

  it("echoes no origin, but still varies, for requests without one", async () => {
    const response = await post(JSON.stringify({ agent: "codex", prompt: "no origin" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("allows the localhost server's own origin", async () => {
    const response = await post(JSON.stringify({ agent: "codex", prompt: "same origin" }), {
      Origin: url,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toBe("same origin");
  });

  it("rejects matching foreign Host and Origin headers", async () => {
    for (const method of ["OPTIONS", "POST"]) {
      const response = await fetch(new URL(AGENT_ENDPOINT, url), {
        method,
        headers: {
          Host: "untrusted.example:4318",
          Origin: "http://untrusted.example:4318",
          "Content-Type": "application/json",
        },
        ...(method === "POST" ? { body: JSON.stringify({ agent: "codex", prompt: "Hello" }) } : {}),
      });
      expect(response.status).toBe(403);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    }
  });

  it.each(["https://untrusted.example", "not-a-url"])(
    "rejects %s before executing agent requests",
    async (origin) => {
      for (const method of ["OPTIONS", "POST"]) {
        const response = await fetch(new URL(AGENT_ENDPOINT, url), {
          method,
          headers: { Origin: origin, "Content-Type": "application/json" },
          ...(method === "POST"
            ? { body: JSON.stringify({ agent: "codex", prompt: "Hello" }) }
            : {}),
        });
        expect(response.status).toBe(403);
        expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
      }
    },
  );
});
