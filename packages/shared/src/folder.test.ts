import { FOLDER_PATH_MESSAGE } from "@eitri/contracts/folder";
import { describe, expect, it } from "vite-plus/test";
import { readBrowseFoldersFailure, readFolderListing, toBrowseFoldersRequest } from "./folder.ts";

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

describe("folder browser replies", () => {
  const listing = {
    path: "/srv/work",
    parentPath: "/srv",
    directories: [{ name: "eitri", path: "/srv/work/eitri" }],
    truncated: false,
  };

  it("reads a complete listing", () => {
    expect(readFolderListing(listing)).toEqual(listing);
  });

  it("rejects an incomplete listing with a stable client message", () => {
    expect(() => readFolderListing({ path: "/srv/work" })).toThrow(
      "Unexpected response from the folder browser.",
    );
  });

  it("passes through a deliberate refusal", () => {
    expect(readBrowseFoldersFailure("“/gone” does not exist.")).toBe("“/gone” does not exist.");
  });

  it("stands in for a malformed refusal", () => {
    expect(readBrowseFoldersFailure({ error: "nope" })).toBe(
      "The folder browser refused the request.",
    );
  });
});
