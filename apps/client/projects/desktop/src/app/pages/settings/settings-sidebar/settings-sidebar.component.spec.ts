import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { provideSpartanHlm } from "@ui/utils";
import { LayoutService } from "@shell/layout/layout.service";
import { SettingsSidebarComponent } from "./settings-sidebar.component";

describe("SettingsSidebarComponent", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideSpartanHlm(),
        provideRouter([]),
        { provide: LayoutService, useValue: { isOpen: () => true } },
      ],
    });
  });

  it("returns to the app and marks the open section", async () => {
    const fixture = TestBed.createComponent(SettingsSidebarComponent);
    await fixture.whenStable();
    const navigate = vi.spyOn(TestBed.inject(Router), "navigateByUrl").mockResolvedValue(true);
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLButtonElement>('button[aria-label="Back to app"]')!.click();
    expect(navigate).toHaveBeenCalledWith("/");
    expect(
      element.querySelector('button[aria-label="General"]')!.getAttribute("aria-current"),
    ).toBe("page");
  });
});
