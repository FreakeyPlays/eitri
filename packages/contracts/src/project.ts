import * as Schema from "effect/Schema";
import { ABSOLUTE_PATH } from "@eitri/contracts/folder";

export const PROJECT_PATH_MESSAGE = "Enter the absolute path of a folder on this computer.";

export const PROJECT_NAME_MESSAGE =
  "Enter a project name of up to 100 characters, or nothing to use the folder's name.";

/** The longest name a project may carry, so one entry cannot crowd out the list. */
export const PROJECT_NAME_MAX = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PathSchema = Schema.String.check(
  Schema.makeFilter((path) => (ABSOLUTE_PATH.test(path) ? undefined : PROJECT_PATH_MESSAGE)),
);

const ProjectIdSchema = Schema.String.check(
  Schema.makeFilter((id) => (UUID.test(id) ? undefined : "Expected a project ID.")),
);

const printable = (name: string) => !/\p{Cc}/u.test(name);

/**
 * A name the user typed, already trimmed by the caller. Empty means the project
 * has no name of its own and follows its folder. Control characters never reach
 * storage.
 */
const ProjectNameSchema = Schema.String.check(
  Schema.makeFilter((name) =>
    name.trim() === name && name.length <= PROJECT_NAME_MAX && printable(name)
      ? undefined
      : PROJECT_NAME_MESSAGE,
  ),
);

/** Opens or registers the project rooted at an absolute path. */
export const OpenProjectRequestSchema = Schema.Struct({ path: PathSchema });
export type OpenProjectRequest = typeof OpenProjectRequestSchema.Type;

/** Drops one project from the remembered list. The directory itself is untouched. */
export const ForgetProjectRequestSchema = Schema.Struct({ id: ProjectIdSchema });
export type ForgetProjectRequest = typeof ForgetProjectRequestSchema.Type;

/**
 * Gives a known project a name of the user's choosing, or clears it with an
 * empty name so the project follows its folder again. The folder is untouched.
 */
export const RenameProjectRequestSchema = Schema.Struct({
  id: ProjectIdSchema,
  name: ProjectNameSchema,
});
export type RenameProjectRequest = typeof RenameProjectRequestSchema.Type;

const ProjectSchema = Schema.Struct({
  id: ProjectIdSchema,
  path: Schema.String,
  name: Schema.String,
  lastOpenedAt: Schema.String,
});

export type Project = typeof ProjectSchema.Type;

/** Every remembered project, most recently opened first. Selection belongs to each client. */
export const ProjectsSchema = Schema.Struct({ projects: Schema.Array(ProjectSchema) });
export type Projects = typeof ProjectsSchema.Type;

/** An open response identifies the project even when its canonical path already existed. */
export const OpenedProjectSchema = Schema.Struct({
  projects: Schema.Array(ProjectSchema),
  openedProjectId: ProjectIdSchema,
});
export type OpenedProject = typeof OpenedProjectSchema.Type;

/** A refused request or unreadable storage, as one sentence the project menu can show. */
export class ProjectsError extends Schema.TaggedError<ProjectsError>()("ProjectsError", {
  message: Schema.String,
}) {}
