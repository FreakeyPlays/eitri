import { TestBed } from "@angular/core/testing";
import { ProvidersComponent } from "./providers.component";

describe("ProvidersComponent", () => {
  it("names the page", async () => {
    const fixture = TestBed.createComponent(ProvidersComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector("h1").textContent).toBe("Providers");
  });
});
