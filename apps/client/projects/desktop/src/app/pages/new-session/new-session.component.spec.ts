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
const guidance = "Choose a folder to work in from the project menu in the title bar.";

describe("NewSessionComponent", () => {
  const active = signal<Project | null>(null);

  beforeEach(() => {
    active.set(null);
    TestBed.configureTestingModule({
      providers: [{ provide: ProjectService, useValue: { active } }],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(NewSessionComponent);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    return {
      fixture,
      element,
      heading: () => element.querySelector("h1")!,
      body: () => element.querySelector("p")!,
    };
  }

  it("shows one title and guidance when no project is selected", async () => {
    const { element, heading, body } = await render();

    expect(heading().textContent?.trim()).toBe("No project selected");
    expect(body().textContent?.trim()).toBe(guidance);
    expect(body().hasAttribute("title")).toBe(false);
    expect(body().classList.contains("truncate")).toBe(false);
    expect(element.querySelectorAll("h1")).toHaveLength(1);
    expect(element.querySelectorAll("p")).toHaveLength(1);
    // No opener of its own: the app bar's dropdown is the only one.
    expect(element.querySelector("button")).toBeNull();
  });

  it("shows only the project name and path when selected", async () => {
    active.set(eitri);
    const { element, heading, body } = await render();

    expect(heading().textContent?.trim()).toBe(eitri.name);
    expect(body().textContent?.trim()).toBe(eitri.path);
    expect(body().title).toBe(eitri.path);
    expect(body().classList.contains("truncate")).toBe(true);
    expect(element.querySelectorAll("p")).toHaveLength(1);
    expect(element.querySelector("button")).toBeNull();
  });

  it("updates the same title and body as the selection changes", async () => {
    const { fixture, heading, body } = await render();
    const title = heading();
    const text = body();

    active.set(eitri);
    await fixture.whenStable();
    expect(heading()).toBe(title);
    expect(body()).toBe(text);
    expect(title.textContent?.trim()).toBe(eitri.name);
    expect(text.textContent?.trim()).toBe(eitri.path);

    active.set(null);
    await fixture.whenStable();
    expect(heading()).toBe(title);
    expect(body()).toBe(text);
    expect(title.textContent?.trim()).toBe("No project selected");
    expect(text.textContent?.trim()).toBe(guidance);
    expect(text.hasAttribute("title")).toBe(false);
    expect(text.classList.contains("truncate")).toBe(false);
  });
});
