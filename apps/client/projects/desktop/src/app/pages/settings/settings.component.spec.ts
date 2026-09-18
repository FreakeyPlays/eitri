import { TestBed } from "@angular/core/testing";
import { SettingsComponent } from "./settings.component";

describe("SettingsComponent", () => {
  it("shows the general settings section", async () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector("h1").textContent).toBe("General");
  });
});
