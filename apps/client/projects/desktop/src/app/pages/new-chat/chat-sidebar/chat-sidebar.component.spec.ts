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

  it("leaves choosing a project to the app bar's dropdown", async () => {
    const fixture = TestBed.createComponent(ChatSidebarComponent);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('button[aria-label="Open Project"]')).toBeNull();
    expect(
      [...element.querySelectorAll("button")].map((button) => button.getAttribute("aria-label")),
    ).toEqual(["New Chat", "Settings"]);
  });

  it("keeps only the icon rail while collapsed", async () => {
    const fixture = TestBed.createComponent(ChatSidebarComponent);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('[aria-label="Open chats"]')).not.toBeNull();
    sidebarExpanded.set(false);
    await fixture.whenStable();
    expect(element.querySelector('[aria-label="Open chats"]')).toBeNull();
    expect(element.querySelectorAll("button")).toHaveLength(2);
  });
});
