import * as Schema from "effect/Schema";

/** Route served by `@eitri/server` and proxied by the Angular dev server. */
export const PROJECTS_ENDPOINT = "/api/projects";

export const PROJECT_PATH_MESSAGE = "Enter the absolute path of a folder on this computer.";

/**
 * A relative path would resolve against whatever directory the backend happens
 * to run in, which is the packaged app's working directory rather than anything
 * the user can see. POSIX roots, Windows drives and UNC shares all qualify.
 */
const ABSOLUTE_PATH = /^(?:\/|[A-Za-z]:[\\/]|\\\\)/;

const PathSchema = Schema.String.check(
  Schema.makeFilter((path) => (ABSOLUTE_PATH.test(path) ? undefined : PROJECT_PATH_MESSAGE)),
);

/**
 * What the user works in, as a JSON HTTP request body: the project rooted in one
 * directory, or every project at once when `path` is null.
 */
export const SelectProjectRequestSchema = Schema.Struct({
  path: Schema.NullOr(PathSchema),
});

export type SelectProjectRequest = typeof SelectProjectRequestSchema.Type;

/** Drops one project from the remembered list. The directory itself is untouched. */
export const ForgetProjectRequestSchema = Schema.Struct({ path: PathSchema });

export type ForgetProjectRequest = typeof ForgetProjectRequestSchema.Type;

/**
 * One project the user opened before. The path is canonical and identifies the
 * project; `name` is derived from it for display, so two projects can share it.
 */
const ProjectSchema = Schema.Struct({
  path: Schema.String,
  name: Schema.String,
  lastOpenedAt: Schema.String,
});

export type Project = typeof ProjectSchema.Type;

/**
 * Every project the user can return to, most recently used first, and what they
 * selected. `activePath` is null while every project is selected at once, which
 * is also where an unavailable last project lands; `notice` then explains it.
 */
export const ProjectsSchema = Schema.Struct({
  projects: Schema.Array(ProjectSchema),
  activePath: Schema.NullOr(Schema.String),
  notice: Schema.NullOr(Schema.String),
});

export type Projects = typeof ProjectsSchema.Type;

/** A rejected request or unreadable storage answers with a message in this shape. */
export const ProjectsFailureSchema = Schema.String;
