import { chmod, mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, delimiter, join } from "node:path";
import { AgentError, PROMPT_RANGE_MESSAGE } from "@eitri/contracts/agent";
import { FOLDER_PATH_MESSAGE, FoldersError } from "@eitri/contracts/folder";
import { ProjectsError } from "@eitri/contracts/project";
import { EitriRpcs } from "@eitri/contracts/rpc";
import { Cause, Effect, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { type Connection, connect, failure, run, socketUrl, start } from "./test-utils/server.ts";

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

/** The same calls without payload schemas, to send what the real client would refuse. */
const Unchecked = RpcGroup.make(
  Rpc.make("agent.ask", { payload: Schema.Unknown, success: Schema.String, error: AgentError }),
  Rpc.make("projects.rename", {
    payload: Schema.Unknown,
    success: Schema.Unknown,
    error: ProjectsError,
  }),
  Rpc.make("folders.browse", {
    payload: Schema.Unknown,
    success: Schema.Unknown,
    error: FoldersError,
  }),
);

const folder = async (prefix: string) => realpath(await mkdtemp(join(tmpdir(), prefix)));

// Bun lets a client choose its Origin header, which a browser never would.
const BunWebSocket = WebSocket as unknown as new (
  url: string,
  options: { headers: Record<string, string> },
) => WebSocket;

/** Resolves once the socket opens, or once the server refused it. */
const handshake = (url: string, origin: string) =>
  new Promise<"open" | "refused">((resolve) => {
    const socket = new BunWebSocket(socketUrl(url), { headers: { Origin: origin } });
    socket.addEventListener("open", () => {
      socket.close();
      resolve("open");
    });
    socket.addEventListener("error", () => resolve("refused"));
  });

describe("RPC server", () => {
  let agents: Awaited<ReturnType<typeof installAgents>>;
  let server: ReturnType<typeof start>;
  let dataDir: string;
  let url: string;
  let connection: Connection<RpcGroup.Rpcs<typeof EitriRpcs>>;
  let unchecked: Connection<RpcGroup.Rpcs<typeof Unchecked>>;

  beforeAll(async () => {
    agents = await installAgents();
    // A throwaway directory; no test may reach the data of an installed Eitri.
    dataDir = await mkdtemp(join(tmpdir(), "eitri-data-"));
    server = start(dataDir);
    url = await server.url;
    connection = await connect(url, EitriRpcs);
    unchecked = await connect(url, Unchecked);
  });

  afterAll(async () => {
    try {
      await connection?.close();
      await unchecked?.close();
      await server?.stop();
    } finally {
      await agents?.uninstall();
      if (dataDir) await rm(dataDir, { recursive: true, force: true });
    }
  });

  /** A payload the RPC server refused before any handler ran, as its readable defect. */
  const refusal = async (effect: Effect.Effect<unknown, unknown>) => {
    const exit = await Effect.runPromiseExit(effect);
    expect(exit._tag).toBe("Failure");
    return exit._tag === "Failure" ? Cause.pretty(exit.cause) : "";
  };

  it("announces the address it listens on", () => {
    expect(server.announced[0]).toMatch(/^Server listening on http:\/\/127\.0\.0\.1:\d+\/?$/);
    expect(new URL(url).hostname).toBe("127.0.0.1");
  });

  it("answers health checks", async () => {
    const response = await fetch(new URL("/health", url));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  describe("agent.ask", () => {
    it("passes the prompt to the CLI and answers with its output", async () => {
      const prompt = "--help\n$(literal) ä";
      expect(await run(connection.client["agent.ask"]({ agent: "codex", prompt }))).toBe(prompt);
    });

    it.each([" ", "ä".repeat(8001)])("refuses the invalid prompt %j by schema", async (prompt) => {
      const refused = await refusal(unchecked.client["agent.ask"]({ agent: "codex", prompt }));
      expect(refused).toContain(PROMPT_RANGE_MESSAGE);
    });

    it("refuses an unknown agent by schema", async () => {
      const refused = await refusal(
        unchecked.client["agent.ask"]({ agent: "unknown", prompt: "Hello" }),
      );
      expect(refused).toContain("agent");
    });

    it("reports a failing CLI as a single-line error", async () => {
      expect(
        await failure(connection.client["agent.ask"]({ agent: "claude", prompt: "Hello" })),
      ).toMatchObject({ _tag: "AgentError", message: "Agent exited with 7: login required" });
    });

    it("survives a CLI exiting before reading a large prompt", async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const error = await failure(
          connection.client["agent.ask"]({ agent: "claude", prompt: "x".repeat(12_000) }),
        );
        expect(error.message).toContain("Agent exited with 7: login required");
      }
      expect(
        await run(connection.client["agent.ask"]({ agent: "codex", prompt: "still running" })),
      ).toBe("still running");
    });
  });

  describe("projects", () => {
    it("starts empty, then remembers what the user opened", async () => {
      expect(await run(connection.client["projects.list"]())).toEqual({ projects: [] });

      const directory = await folder("eitri-project-");
      try {
        expect(await run(connection.client["projects.open"]({ path: directory }))).toEqual({
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
        expect(await run(connection.client["projects.list"]())).toMatchObject({
          projects: [{ path: directory }],
        });
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });

    it.each([
      { path: "/nope/missing", expected: "does not exist" },
      { path: "README.md", expected: "is not a folder" },
    ])("refuses $path with a message the menu can show", async ({ path, expected }) => {
      const directory = await folder("eitri-file-");
      await Bun.write(join(directory, "README.md"), "not a project");
      try {
        const target = path.startsWith("/") ? path : join(directory, path);
        const error = await failure(connection.client["projects.open"]({ path: target }));
        expect(error).toMatchObject({ _tag: "ProjectsError" });
        expect(error.message).toContain(expected);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });

    it("renames a project by ID, clears it, and refuses an unusable name", async () => {
      const directory = await folder("eitri-named-");
      try {
        const { openedProjectId: id } = await run(
          connection.client["projects.open"]({ path: directory }),
        );
        expect(
          await run(connection.client["projects.rename"]({ id, name: "Client portal" })),
        ).toMatchObject({
          projects: expect.arrayContaining([
            expect.objectContaining({ id, path: directory, name: "Client portal" }),
          ]),
        });
        expect(await run(connection.client["projects.rename"]({ id, name: "" }))).toMatchObject({
          projects: expect.arrayContaining([
            expect.objectContaining({ id, name: basename(directory) }),
          ]),
        });
        expect(
          await refusal(unchecked.client["projects.rename"]({ id, name: "  padded  " })),
        ).toContain("Enter a project name");
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });

    it("forgets a project by ID, and refuses one it does not know", async () => {
      const directory = await folder("eitri-known-");
      try {
        const { openedProjectId: id } = await run(
          connection.client["projects.open"]({ path: directory }),
        );
        const { projects } = await run(connection.client["projects.forget"]({ id }));
        expect(projects.map((project) => project.id)).not.toContain(id);
        expect(await failure(connection.client["projects.forget"]({ id }))).toMatchObject({
          _tag: "ProjectsError",
          message: "That project is not in the list.",
        });
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
  });

  describe("folders.browse", () => {
    it("lists an explicit path through the shared contract", async () => {
      const directory = await folder("eitri-folders-");
      await Promise.all([mkdir(join(directory, "zeta")), mkdir(join(directory, "space ü"))]);
      try {
        expect(await run(connection.client["folders.browse"]({ path: directory }))).toEqual({
          path: directory,
          directories: [
            { name: "space ü", path: join(directory, "space ü") },
            { name: "zeta", path: join(directory, "zeta") },
          ],
          truncated: false,
        });
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });

    it("answers a missing folder with a sentence", async () => {
      expect(
        await failure(connection.client["folders.browse"]({ path: "/nope/missing" })),
      ).toMatchObject({ _tag: "FoldersError", message: "“/nope/missing” does not exist." });
    });

    it("refuses a relative path by schema, before touching the disk", async () => {
      expect(
        await refusal(unchecked.client["folders.browse"]({ path: "relative/path" })),
      ).toContain(FOLDER_PATH_MESSAGE);
    });
  });

  describe("origins", () => {
    it.each([
      "tauri://localhost",
      "http://tauri.localhost",
      "https://tauri.localhost",
      "http://localhost:1420",
      "http://127.0.0.1:1420",
    ])("accepts a WebSocket from %s", async (origin) => {
      expect(await handshake(url, origin)).toBe("open");
    });

    it("accepts the localhost server's own origin", async () => {
      expect(await handshake(url, new URL(url).origin)).toBe("open");
    });

    it.each(["https://untrusted.example", "not-a-url"])(
      "refuses %s before the upgrade",
      async (origin) => {
        expect(await handshake(url, origin)).toBe("refused");
        const response = await fetch(socketUrl(url).replace(/^ws/, "http"), {
          headers: { Origin: origin },
        });
        expect(response.status).toBe(403);
      },
    );

    it("refuses matching foreign Host and Origin headers", async () => {
      const response = await fetch(socketUrl(url).replace(/^ws/, "http"), {
        headers: { Host: "untrusted.example:4318", Origin: "http://untrusted.example:4318" },
      });
      expect(response.status).toBe(403);
    });
  });
});
