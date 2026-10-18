import { TestBed } from "@angular/core/testing";
import { WikiComponent } from "./wiki.component";

describe("WikiComponent", () => {
  it("names the page", async () => {
    const fixture = TestBed.createComponent(WikiComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector("h1").textContent).toBe("Wiki");
  });
});
