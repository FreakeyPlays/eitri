import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type { Project } from "@eitri/contracts/project";
import { ProjectService } from "@features/projects/project.service";
import { NewSessionComponent } from "./new-session.component";

const eitri = {
  id: "ca0dcace-34da-4b44-8364-13ce54a32e44",
  path: "/git/eitri",
  name: "eitri",
  lastOpenedAt: "2026-09-21T10:00:00.000Z",
};

// Without a project the route scope shows its introduction instead of this page.
describe("NewSessionComponent", () => {
  const active = signal<Project | null>(eitri);

  beforeEach(() => {
    active.set(eitri);
    TestBed.configureTestingModule({
      providers: [{ provide: ProjectService, useValue: { active } }],
    });
  });

  it("shows the selected project's name and path", async () => {
    const fixture = TestBed.createComponent(NewSessionComponent);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const body = element.querySelector("p")!;

    expect(element.querySelector("h1")!.textContent?.trim()).toBe(eitri.name);
    expect(body.textContent?.trim()).toBe(eitri.path);
    expect(body.title).toBe(eitri.path);
    expect(element.querySelector("button")).toBeNull();
  });
});
