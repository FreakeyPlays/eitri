import { FOLDER_PATH_MESSAGE } from "@eitri/contracts/folder";
import { describe, expect, it } from "vite-plus/test";
import { toBrowseFoldersRequest } from "./folder.ts";

describe("folder browser requests", () => {
  it("omits the path when browsing from home", () => {
    expect(toBrowseFoldersRequest()).toEqual({});
  });

  it("accepts an explicit absolute path", () => {
    expect(toBrowseFoldersRequest("/srv/work")).toEqual({ path: "/srv/work" });
  });

  it("reports an invalid path as one useful sentence", () => {
    expect(() => toBrowseFoldersRequest("relative/path")).toThrow(FOLDER_PATH_MESSAGE);
  });
});
