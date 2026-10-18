import { TestBed } from "@angular/core/testing";
import { PreferencesComponent } from "./preferences.component";

describe("PreferencesComponent", () => {
  it("names the page", async () => {
    const fixture = TestBed.createComponent(PreferencesComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector("h1").textContent).toBe("Preferences");
  });
});
