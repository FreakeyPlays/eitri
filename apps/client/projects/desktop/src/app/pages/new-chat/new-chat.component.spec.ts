import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type { Project } from "@eitri/contracts/project";
import { provideSpartanHlm } from "@ui/utils";
import { ProjectService } from "@core/projects/project.service";
import { NewChatComponent } from "./new-chat.component";

describe("NewChatComponent", () => {
  const active = signal<Project | null>(null);
  const projects = signal<Project[]>([]);

  beforeEach(() => {
    active.set(null);
    projects.set([]);
    TestBed.configureTestingModule({
      providers: [
        provideSpartanHlm(),
        { provide: ProjectService, useValue: { active, projects, busy: signal(false) } },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(NewChatComponent);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    return { fixture, element, heading: () => element.querySelector("h1")!.textContent };
  }

  it("points at the title bar while no project is open", async () => {
    const { element, heading } = await render();

    expect(heading()).toBe("No project open");
    expect(element.textContent).toContain("title bar");
    // No opener of its own: the app bar's dropdown is the only one.
    expect(element.querySelector("button")).toBeNull();
  });

  it("names the open project and where it lives", async () => {
    const eitri = { path: "/git/eitri", name: "eitri", lastOpenedAt: "2026-09-21T10:00:00.000Z" };
    active.set(eitri);
    projects.set([eitri]);
    const { element, heading } = await render();

    expect(heading()).toBe("eitri");
    expect(element.textContent).toContain("/git/eitri");
    expect(element.querySelector("button")).toBeNull();
  });

  it("says so while working across every project", async () => {
    projects.set([{ path: "/git/eitri", name: "eitri", lastOpenedAt: "2026-09-21T10:00:00.000Z" }]);
    const { element, heading } = await render();

    expect(heading()).toBe("All projects");
    expect(element.textContent).toContain("across every project");
  });
});
