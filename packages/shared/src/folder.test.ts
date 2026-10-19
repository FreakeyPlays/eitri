import { FOLDER_PATH_MESSAGE } from "@eitri/contracts/folder";
import { describe, expect, it } from "vite-plus/test";
import { toBrowseFoldersRequest } from "./folder.ts";

describe("folder browser requests", () => {
  it("omits the path when browsing folders from home", () => {
    expect(toBrowseFoldersRequest()).toStrictEqual({});
  });

  it("accepts an explicit absolute path", () => {
    expect(toBrowseFoldersRequest("/srv/work")).toEqual({ path: "/srv/work" });
  });

  it("reports an invalid path as one useful sentence", () => {
    const request = () => toBrowseFoldersRequest("relative/path");
    expect(request).toThrow(Error);
    expect(request).toThrow(FOLDER_PATH_MESSAGE);
  });
});
