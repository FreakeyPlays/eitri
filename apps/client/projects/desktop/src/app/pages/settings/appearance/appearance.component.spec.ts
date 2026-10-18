import { TestBed } from "@angular/core/testing";
import { AppearanceComponent } from "./appearance.component";

describe("AppearanceComponent", () => {
  it("names the page", async () => {
    const fixture = TestBed.createComponent(AppearanceComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector("h1").textContent).toBe("Appearance");
  });
});
