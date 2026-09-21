import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";
import {
  ForgetProjectRequestSchema,
  PROJECT_PATH_MESSAGE,
  ProjectsSchema,
  SelectProjectRequestSchema,
} from "./project.ts";

describe("SelectProjectRequestSchema", () => {
  const decodeRequest = Schema.decodeUnknownSync(SelectProjectRequestSchema);

  it("selects every project at once with no path", () => {
    expect(decodeRequest({ path: null })).toEqual({ path: null });
  });

  it.each(["/home/chris/git/eitri", "C:\\Users\\chris\\eitri", "D:/work", "\\\\build\\share"])(
    "accepts the absolute path %j",
    (path) => {
      expect(decodeRequest({ path })).toEqual({ path });
    },
  );

  it.each(["", "   ", "eitri", "./eitri", "~/git/eitri"])("rejects the path %j", (path) => {
    expect(() => decodeRequest({ path })).toThrow(PROJECT_PATH_MESSAGE);
  });

  it.each([42, undefined, {}])("rejects the non-path %j", (path) => {
    expect(() => decodeRequest({ path })).toThrow();
  });
});

describe("ForgetProjectRequestSchema", () => {
  const decodeRequest = Schema.decodeUnknownSync(ForgetProjectRequestSchema);

  it("names the one project to drop from the list", () => {
    expect(decodeRequest({ path: "/git/eitri" })).toEqual({ path: "/git/eitri" });
  });

  // Unlike selecting, there is no "all" to forget: the path is required.
  it.each([null, undefined, "eitri"])("rejects %j", (path) => {
    expect(() => decodeRequest({ path })).toThrow();
  });
});

describe("ProjectsSchema", () => {
  const decodeProjects = Schema.decodeUnknownSync(ProjectsSchema);

  it("carries the recent projects, the open one and no notice", () => {
    const payload = {
      projects: [{ path: "/git/eitri", name: "eitri", lastOpenedAt: "2026-09-21T10:00:00.000Z" }],
      activePath: "/git/eitri",
      notice: null,
    };

    expect(decodeProjects(payload)).toEqual(payload);
  });

  it("describes an unavailable project with no open path", () => {
    const decoded = decodeProjects({
      projects: [],
      activePath: null,
      notice: "“/git/gone” is no longer available.",
    });

    expect(decoded.activePath).toBeNull();
    expect(decoded.notice).toContain("no longer available");
  });

  it.each([
    { projects: [], activePath: null },
    { projects: [{ path: "/git/eitri" }], activePath: null, notice: null },
    { projects: {}, activePath: null, notice: null },
  ])("rejects the incomplete payload %j", (payload) => {
    expect(() => decodeProjects(payload)).toThrow();
  });
});
