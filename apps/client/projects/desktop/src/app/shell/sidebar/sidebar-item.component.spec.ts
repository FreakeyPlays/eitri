import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideSpartanHlm } from "@ui/utils";
import { SidebarItemComponent } from "./sidebar-item.component";
import { LayoutService } from "@shell/layout/layout.service";

describe("SidebarItemComponent", () => {
  const sidebarExpanded = signal(true);

  beforeEach(() => {
    sidebarExpanded.set(true);
    TestBed.configureTestingModule({
      providers: [
        provideSpartanHlm(),
        { provide: LayoutService, useValue: { isOpen: () => sidebarExpanded() } },
      ],
    });
  });

  it("shows its label only while the sidebar is expanded", async () => {
    const fixture = TestBed.createComponent(SidebarItemComponent);
    fixture.componentRef.setInput("label", "Settings");
    await fixture.whenStable();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector("button");
    expect(button.getAttribute("aria-label")).toBe("Settings");
    expect(button.textContent?.trim()).toBe("Settings");
    sidebarExpanded.set(false);
    await fixture.whenStable();
    expect(button.textContent?.trim()).toBe("");
  });

  it("marks the active item as the current page", async () => {
    const fixture = TestBed.createComponent(SidebarItemComponent);
    fixture.componentRef.setInput("label", "General");
    fixture.componentRef.setInput("active", true);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector("button").getAttribute("aria-current")).toBe("page");
  });
});
