import { PROJECT_NAME_MESSAGE, PROJECT_PATH_MESSAGE } from "@eitri/contracts/project";
import { describe, expect, it } from "vite-plus/test";
import {
  readOpenedProject,
  readProjects,
  readProjectsFailure,
  toForgetProjectRequest,
  toOpenProjectRequest,
  toRenameProjectRequest,
} from "./project.ts";

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

describe("project replies", () => {
  it("reads the server's project collection", () => {
    const snapshot = { projects: [project] };
    expect(readProjects(snapshot)).toEqual(snapshot);
  });

  it("reads an opened project ID with the refreshed collection", () => {
    const opened = { projects: [project], openedProjectId: id };
    expect(readOpenedProject(opened)).toEqual(opened);
  });

  it.each([{ projects: [] }, "recent", undefined])(
    "rejects the incomplete opened payload %j",
    (reply) => {
      expect(() => readOpenedProject(reply)).toThrow("Unexpected response");
    },
  );

  it("rejects an opened ID that is absent from the returned collection", () => {
    expect(() =>
      readOpenedProject({
        projects: [project],
        openedProjectId: "f03411f4-d917-49da-b10b-4e2c5cb1fb1c",
      }),
    ).toThrow("Unexpected response from the project backend.");
  });

  it("does not carry selection fields from a legacy server reply into client state", () => {
    expect(
      readProjects({ projects: [project], activePath: project.path, notice: "legacy" }),
    ).toEqual({
      projects: [project],
    });
  });
});

describe("readProjectsFailure", () => {
  it("passes a deliberate refusal to the user", () => {
    expect(readProjectsFailure("“/git/gone” is not a folder.")).toBe(
      "“/git/gone” is not a folder.",
    );
  });

  it.each([{ error: "nope" }, undefined, 7])("stands in for the malformed refusal %j", (reply) => {
    expect(readProjectsFailure(reply)).toBe("The project backend refused the request.");
  });
});
