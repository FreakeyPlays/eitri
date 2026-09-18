import { TestBed } from "@angular/core/testing";
import { NewChatComponent } from "./new-chat.component";

describe("NewChatComponent", () => {
  it("invites the user to start a chat", async () => {
    const fixture = TestBed.createComponent(NewChatComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector("h1").textContent).toBe("New Chat");
  });
});
