import { TestBed } from "@angular/core/testing";
import { ManageComponent } from "./manage.component";

describe("ManageComponent", () => {
  it("names the page", async () => {
    const fixture = TestBed.createComponent(ManageComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector("h1").textContent).toBe("Manage");
  });
});
