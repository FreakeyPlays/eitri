import {
  type ForgetProjectRequest,
  ForgetProjectRequestSchema,
  type OpenedProject,
  OpenedProjectSchema,
  type OpenProjectRequest,
  OpenProjectRequestSchema,
  type Projects,
  ProjectsFailureSchema,
  ProjectsSchema,
  type RenameProjectRequest,
  RenameProjectRequestSchema,
} from "@eitri/contracts/project";
import * as Schema from "effect/Schema";

const decodeOpen = Schema.decodeUnknownSync(OpenProjectRequestSchema);
const decodeForget = Schema.decodeUnknownSync(ForgetProjectRequestSchema);
const decodeRename = Schema.decodeUnknownSync(RenameProjectRequestSchema);
const decodeProjects = Schema.decodeUnknownSync(ProjectsSchema);
const decodeOpened = Schema.decodeUnknownSync(OpenedProjectSchema);
const decodeFailure = Schema.decodeUnknownSync(ProjectsFailureSchema);

const sentence = (error: unknown) =>
  new Error(String(error instanceof Error ? error.message : error).split("\n")[0]);

export function toOpenProjectRequest(path: string): OpenProjectRequest {
  try {
    return decodeOpen({ path });
  } catch (error: unknown) {
    throw sentence(error);
  }
}

export function toForgetProjectRequest(id: string): ForgetProjectRequest {
  try {
    return decodeForget({ id });
  } catch (error: unknown) {
    throw sentence(error);
  }
}

/** Trims here so the schema can reject only names that are genuinely unusable. */
export function toRenameProjectRequest(id: string, name: string): RenameProjectRequest {
  try {
    return decodeRename({ id, name: name.trim() });
  } catch (error: unknown) {
    throw sentence(error);
  }
}

export function readProjects(reply: unknown): Projects {
  try {
    return decodeProjects(reply);
  } catch {
    throw new Error("Unexpected response from the project backend.");
  }
}

export function readOpenedProject(reply: unknown): OpenedProject {
  try {
    const opened = decodeOpened(reply);
    if (!opened.projects.some((project) => project.id === opened.openedProjectId)) {
      throw new Error("Opened project is absent from the collection.");
    }
    return opened;
  } catch {
    throw new Error("Unexpected response from the project backend.");
  }
}

export function readProjectsFailure(reply: unknown): string {
  try {
    return decodeFailure(reply);
  } catch {
    return "The project backend refused the request.";
  }
}
