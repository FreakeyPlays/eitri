import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";
import {
  ForgetProjectRequestSchema,
  OpenedProjectSchema,
  OpenProjectRequestSchema,
  PROJECT_NAME_MAX,
  PROJECT_NAME_MESSAGE,
  PROJECT_PATH_MESSAGE,
  ProjectsSchema,
  RenameProjectRequestSchema,
  UpdateProjectPathRequestSchema,
} from "./project.ts";

const project = {
  id: "ca0dcace-34da-4b44-8364-13ce54a32e44",
  path: "/git/eitri",
  name: "eitri",
  lastOpenedAt: "2026-09-21T10:00:00.000Z",
};

describe("OpenProjectRequestSchema", () => {
  const decodeRequest = Schema.decodeUnknownSync(OpenProjectRequestSchema);

  it.each(["/home/chris/git/eitri", "C:\\Users\\chris\\eitri", "D:/work", "\\\\build\\share"])(
    "accepts the absolute path %j",
    (path) => {
      expect(decodeRequest({ path })).toEqual({ path });
    },
  );

  it.each(["", "   ", "eitri", "./eitri", "~/git/eitri"])("rejects the path %j", (path) => {
    expect(() => decodeRequest({ path })).toThrow(PROJECT_PATH_MESSAGE);
  });
});

describe("RenameProjectRequestSchema", () => {
  const decodeRename = Schema.decodeUnknownSync(RenameProjectRequestSchema);

  // An empty name is the documented way to clear one, so it must decode.
  it.each(["", "eitri", "Client portal", "Ünïcodé — 日本語", "a".repeat(PROJECT_NAME_MAX)])(
    "accepts the name %j",
    (name) => {
      expect(decodeRename({ id: project.id, name })).toEqual({ id: project.id, name });
    },
  );

  it.each(["   ", " padded", "padded ", "a".repeat(PROJECT_NAME_MAX + 1), "two\nlines"])(
    "rejects the name %j",
    (name) => {
      expect(() => decodeRename({ id: project.id, name })).toThrow(PROJECT_NAME_MESSAGE);
    },
  );
});

describe("project ID requests", () => {
  const decodeForget = Schema.decodeUnknownSync(ForgetProjectRequestSchema);
  const decodeUpdate = Schema.decodeUnknownSync(UpdateProjectPathRequestSchema);

  it("forgets a project by stable ID", () => {
    expect(decodeForget({ id: project.id })).toEqual({ id: project.id });
  });

  it("relocates a project without changing its identity", () => {
    expect(decodeUpdate({ id: project.id, path: "/git/moved" })).toEqual({
      id: project.id,
      path: "/git/moved",
    });
  });

  it.each([null, undefined, "eitri", "/git/eitri", "00000000-0000-0000-0000-000000000000"])(
    "rejects the invalid project ID %j",
    (id) => {
      expect(() => decodeForget({ id })).toThrow();
    },
  );

  it("rejects a relative relocation path", () => {
    expect(() => decodeUpdate({ id: project.id, path: "git/moved" })).toThrow(PROJECT_PATH_MESSAGE);
  });
});

describe("project replies", () => {
  const decodeProjects = Schema.decodeUnknownSync(ProjectsSchema);
  const decodeOpened = Schema.decodeUnknownSync(OpenedProjectSchema);

  it("carries the remembered collection without server selection state", () => {
    expect(decodeProjects({ projects: [project] })).toEqual({ projects: [project] });
  });

  it("identifies the project opened by a path", () => {
    const payload = { projects: [project], openedProjectId: project.id };
    expect(decodeOpened(payload)).toEqual(payload);
  });

  it.each([
    { projects: [{ path: "/git/eitri", name: "eitri", lastOpenedAt: project.lastOpenedAt }] },
    { projects: [{ ...project, id: "/git/eitri" }] },
    { projects: {} },
  ])("rejects the malformed collection %j", (payload) => {
    expect(() => decodeProjects(payload)).toThrow();
  });

  it("rejects an open reply whose opened ID is missing", () => {
    expect(() => decodeOpened({ projects: [project] })).toThrow();
  });
});
