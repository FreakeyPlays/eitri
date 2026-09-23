import { join, sep } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { DATA_DIR, DEV_DATA_DIR, resolveDataDir } from "./data-dir.ts";

/** Pure resolution only: no test here may create or read any of these directories. */
describe("resolveDataDir", () => {
  const home = "/home/chris";

  it("keeps the installed app's data in the user's home directory", () => {
    expect(resolveDataDir({ override: undefined, dev: false, home })).toBe(
      join(home, DATA_DIR, "userdata"),
    );
  });

  it("keeps development beside the installed data, never inside it", () => {
    const development = resolveDataDir({ override: undefined, dev: true, home });

    expect(development).toBe(join(home, DEV_DATA_DIR, "userdata"));
    expect(development.startsWith(join(home, DATA_DIR) + sep)).toBe(false);
  });

  it.each([undefined, "", "   "])("falls back when the override is %j", (override) => {
    expect(resolveDataDir({ override, dev: false, home })).toBe(join(home, DATA_DIR, "userdata"));
  });

  it("lets an override win over both defaults, so tests stay isolated", () => {
    for (const dev of [false, true]) {
      expect(resolveDataDir({ override: "/tmp/eitri-test ", dev, home })).toBe("/tmp/eitri-test");
    }
  });

  it("resolves a relative override against the working directory", () => {
    expect(resolveDataDir({ override: "userdata", dev: false, home })).toBe(
      join(process.cwd(), "userdata"),
    );
  });
});
