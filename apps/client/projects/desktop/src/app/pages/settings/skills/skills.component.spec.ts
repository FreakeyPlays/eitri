import { TestBed } from "@angular/core/testing";
import { SkillsComponent } from "./skills.component";

describe("SkillsComponent", () => {
  it("names the page", async () => {
    const fixture = TestBed.createComponent(SkillsComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector("h1").textContent).toBe("Skills");
  });
});
