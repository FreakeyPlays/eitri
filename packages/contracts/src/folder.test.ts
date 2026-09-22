import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";
import { BrowseFoldersRequestSchema, FOLDER_PATH_MESSAGE, FolderListingSchema } from "./folder.ts";

describe("BrowseFoldersRequestSchema", () => {
  const decode = Schema.decodeUnknownSync(BrowseFoldersRequestSchema);

  it("uses an omitted path for the server home folder", () => {
    expect(decode({})).toEqual({});
  });

  it.each(["/home/chris", "C:\\Users\\chris", "D:/work", "\\\\build\\share", "~", "~/git"])(
    "accepts the navigable path %j",
    (path) => expect(decode({ path })).toEqual({ path }),
  );

  it.each(["", "relative", "./folder", "~another-user"])("rejects %j", (path) => {
    expect(() => decode({ path })).toThrow(FOLDER_PATH_MESSAGE);
  });
});

describe("FolderListingSchema", () => {
  const decode = Schema.decodeUnknownSync(FolderListingSchema);

  it("carries canonical child paths and truncation", () => {
    const listing = {
      path: "/srv/work",
      directories: [{ name: "eitri", path: "/srv/work/eitri" }],
      truncated: true,
    };

    expect(decode(listing)).toEqual(listing);
  });
});
