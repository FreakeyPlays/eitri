import {
  filterPart,
  folderPart,
  matching,
  parentOf,
  requestPath,
  withSeparator,
} from "./folder-path";

describe("folder paths", () => {
  it.each([
    ["~/git/ei", "~/git/", "ei"],
    ["~/git/", "~/git/", ""],
    ["git", "", "git"],
    ["C:\\Users\\me\\Doc", "C:\\Users\\me\\", "Doc"],
    ["~/git/ ei ", "~/git/", "ei"],
  ])("splits %j into folder %j and filter %j", (value, folder, filter) => {
    expect(folderPart(value)).toBe(folder);
    expect(filterPart(value)).toBe(filter);
  });

  it.each([
    ["/home/me", "/home/me/"],
    ["/home/me/", "/home/me/"],
    ["C:\\Users", "C:\\Users\\"],
    ["C:\\", "C:\\"],
  ])("ends %j with its own separator", (path, expected) => {
    expect(withSeparator(path)).toBe(expected);
  });

  it.each([
    ["~/git/", "~/git"],
    [" ~/git// ", "~/git"],
    ["/", "/"],
    [" / ", "/"],
    ["~/", "~"],
    ["C:\\", "C:\\"],
    [" C:\\ ", "C:\\"],
    ["C:\\Users\\", "C:\\Users"],
  ])("asks the server for %j as %j", (folder, expected) => {
    expect(requestPath(folder)).toBe(expected);
  });

  it.each([
    ["~/git/eitri/", "~/git/"],
    ["~/git//", "~/"],
    ["/home/", "/"],
    ["/", null],
    ["~/", null],
    ["C:\\Users\\me\\", "C:\\Users\\"],
    ["C:\\", null],
  ])("finds the parent of %j", (folder, expected) => {
    expect(parentOf(folder)).toBe(expected);
  });

  const directories = ["legit", "Git", ".git", "games"].map((name) => ({
    name,
    path: `/home/me/${name}`,
  }));
  const names = (filter: string) => matching(directories, filter).map(({ name }) => name);

  it("ranks prefix matches before containment, ignoring case", () => {
    expect(names("git")).toEqual(["Git", "legit"]);
  });

  it("shows dot folders only when the filter starts with a dot", () => {
    expect(names("")).toEqual(["legit", "Git", "games"]);
    expect(names(".g")).toEqual([".git"]);
  });
});
