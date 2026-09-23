import { TestBed } from "@angular/core/testing";
import { EmptyPanelComponent } from "./empty-panel.component";

describe("EmptyPanelComponent", () => {
  it("renders a blank panel", async () => {
    const fixture = TestBed.createComponent(EmptyPanelComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toBe("");
  });
});
