import { TestBed } from "@angular/core/testing";
import { OverviewComponent } from "./overview.component";

describe("OverviewComponent", () => {
  it("names the page", async () => {
    const fixture = TestBed.createComponent(OverviewComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector("h1").textContent).toBe("Overview");
  });
});
