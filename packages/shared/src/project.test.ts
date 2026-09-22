import { PROJECT_NAME_MESSAGE, PROJECT_PATH_MESSAGE } from "@eitri/contracts/project";
import { describe, expect, it } from "vite-plus/test";
import { toForgetProjectRequest, toOpenProjectRequest, toRenameProjectRequest } from "./project.ts";

const id = "ca0dcace-34da-4b44-8364-13ce54a32e44";
const project = {
  id,
  path: "/git/eitri",
  name: "eitri",
  lastOpenedAt: "2026-09-21T10:00:00.000Z",
};

describe("project requests", () => {
  it("opens a project by absolute path", () => {
    expect(toOpenProjectRequest(project.path)).toEqual({ path: project.path });
  });

  it("forgets a project by stable ID", () => {
    expect(toForgetProjectRequest(id)).toEqual({ id });
  });

  it("trims a chosen name before validating it", () => {
    expect(toRenameProjectRequest(id, "  Client portal  ")).toEqual({ id, name: "Client portal" });
  });

  it.each(["", "   "])("treats the blank name %j as clearing the name", (name) => {
    expect(toRenameProjectRequest(id, name)).toEqual({ id, name: "" });
  });

  it("rejects a name that is too long", () => {
    expect(() => toRenameProjectRequest(id, "a".repeat(101))).toThrow(
      new Error(PROJECT_NAME_MESSAGE),
    );
  });

  it.each(["", "git/eitri", "~/git/eitri"])("rejects the relative open path %j", (path) => {
    expect(() => toOpenProjectRequest(path)).toThrow(new Error(PROJECT_PATH_MESSAGE));
  });

  it("rejects a path where an ID is required", () => {
    expect(() => toForgetProjectRequest(project.path)).toThrow(new Error("Expected a project ID."));
  });
});
