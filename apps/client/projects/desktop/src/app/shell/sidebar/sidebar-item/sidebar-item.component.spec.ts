import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { provideSpartanHlm } from "@ui/utils";
import { SidebarItemComponent } from "./sidebar-item.component";
import { LayoutService } from "@shell/layout/layout.service";

@Component({ template: "" })
class BlankComponent {}

describe("SidebarItemComponent", () => {
  const sidebarExpanded = signal(true);

  beforeEach(() => {
    sidebarExpanded.set(true);
    TestBed.configureTestingModule({
      providers: [
        provideSpartanHlm(),
        provideRouter([{ path: "**", component: BlankComponent }]),
        { provide: LayoutService, useValue: { sidebarShown: sidebarExpanded } },
      ],
    });
  });

  async function render(label: string, link: string) {
    const fixture = TestBed.createComponent(SidebarItemComponent);
    fixture.componentRef.setInput("label", label);
    fixture.componentRef.setInput("link", link);
    await fixture.whenStable();
    const anchor: HTMLAnchorElement = fixture.nativeElement.querySelector("a");
    return { fixture, anchor };
  }

  it("shows its label only while the sidebar is expanded", async () => {
    const { fixture, anchor } = await render("Settings", "/settings");
    expect(anchor.getAttribute("aria-label")).toBe("Settings");
    expect(anchor.getAttribute("href")).toBe("/settings");
    expect(anchor.textContent?.trim()).toBe("Settings");
    sidebarExpanded.set(false);
    await fixture.whenStable();
    expect(anchor.textContent?.trim()).toBe("");
  });

  it("marks only an exactly matching link as the current page", async () => {
    const home = await render("Back", "/");
    const wiki = await render("Wiki", "/wiki");
    await TestBed.inject(Router).navigateByUrl("/wiki");
    await home.fixture.whenStable();
    await wiki.fixture.whenStable();
    expect(wiki.anchor.getAttribute("aria-current")).toBe("page");
    expect(home.anchor.hasAttribute("aria-current")).toBe(false);
  });
});
