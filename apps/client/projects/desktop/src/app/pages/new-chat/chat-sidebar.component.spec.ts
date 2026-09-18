import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { provideSpartanHlm } from "@ui/utils";
import { LayoutService } from "@shell/layout/layout.service";
import { ChatSidebarComponent } from "./chat-sidebar.component";

describe("ChatSidebarComponent", () => {
  const sidebarExpanded = signal(true);

  beforeEach(() => {
    sidebarExpanded.set(true);
    TestBed.configureTestingModule({
      providers: [
        provideSpartanHlm(),
        provideRouter([]),
        { provide: LayoutService, useValue: { isOpen: () => sidebarExpanded() } },
      ],
    });
  });

  it("navigates to a new chat and to settings", async () => {
    const fixture = TestBed.createComponent(ChatSidebarComponent);
    await fixture.whenStable();
    const navigate = vi.spyOn(TestBed.inject(Router), "navigateByUrl").mockResolvedValue(true);
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLButtonElement>('button[aria-label="Settings"]')!.click();
    element.querySelector<HTMLButtonElement>('button[aria-label="New Chat"]')!.click();
    expect(navigate.mock.calls).toEqual([["/settings"], ["/"]]);
  });

  it("opens the add project dialog", async () => {
    const fixture = TestBed.createComponent(ChatSidebarComponent);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('button[aria-label="Add Project"]').click();
    await fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Add a project");
  });

  it("keeps only the icon rail while collapsed", async () => {
    const fixture = TestBed.createComponent(ChatSidebarComponent);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('[aria-label="Open chats"]')).not.toBeNull();
    sidebarExpanded.set(false);
    await fixture.whenStable();
    expect(element.querySelector('[aria-label="Open chats"]')).toBeNull();
    expect(element.querySelectorAll("button")).toHaveLength(3);
  });
});
