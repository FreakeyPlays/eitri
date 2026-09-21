import { PROJECT_PATH_MESSAGE } from "@eitri/contracts/project";
import { describe, expect, it } from "vite-plus/test";
import {
  readProjects,
  readProjectsFailure,
  toForgetProjectRequest,
  toSelectProjectRequest,
} from "./project.ts";

describe("toSelectProjectRequest", () => {
  it("passes an absolute path through as the request the adapters send", () => {
    expect(toSelectProjectRequest("/home/chris/git/eitri")).toEqual({
      path: "/home/chris/git/eitri",
    });
  });

  it("asks for every project at once with no path", () => {
    expect(toSelectProjectRequest(null)).toEqual({ path: null });
  });

  it.each(["", "git/eitri", "~/git/eitri"])(
    "reports the rejected path %j in the wording the backend uses",
    (path) => {
      expect(() => toSelectProjectRequest(path)).toThrow(new Error(PROJECT_PATH_MESSAGE));
    },
  );
});

describe("toForgetProjectRequest", () => {
  it("names the project to drop from the list", () => {
    expect(toForgetProjectRequest("/git/eitri")).toEqual({ path: "/git/eitri" });
  });

  it("refuses a path the backend would refuse", () => {
    expect(() => toForgetProjectRequest("git/eitri")).toThrow(new Error(PROJECT_PATH_MESSAGE));
  });
});

describe("readProjects", () => {
  it("returns the snapshot of a well-behaved backend", () => {
    const snapshot = {
      projects: [{ path: "/git/eitri", name: "eitri", lastOpenedAt: "2026-09-21T10:00:00.000Z" }],
      activePath: "/git/eitri",
      notice: null,
    };

    expect(readProjects(snapshot)).toEqual(snapshot);
  });

  it.each([{ projects: [] }, "recent", undefined])("rejects the payload %j", (reply) => {
    expect(() => readProjects(reply)).toThrow("Unexpected response");
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
