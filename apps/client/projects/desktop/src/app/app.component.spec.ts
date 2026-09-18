import { TestBed } from "@angular/core/testing";
import { AppComponent } from "./app.component";

const { isTauri } = vi.hoisted(() => ({ isTauri: vi.fn(() => true) }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri }));

describe("AppComponent interaction defaults", () => {
  beforeEach(() => {
    isTauri.mockReturnValue(true);
    TestBed.configureTestingModule({}).overrideComponent(AppComponent, {
      set: {
        imports: [],
        template: `<header data-app-chrome>
          <button><span>Toggle</span></button><input /><textarea></textarea>
          <div contenteditable="true"><b>Edit</b></div>
          <a href="/settings">Settings</a><p class="select-text">Copy me</p>
          <div data-native-context-menu>Native menu</div>
        </header><main>Answer</main>`,
      },
    });
  });

  function setup() {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const contextMenu = (selector: string, shiftKey = false) => {
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, shiftKey });
      root.querySelector(selector)!.dispatchEvent(event);
      return event;
    };
    return { root, contextMenu };
  }

  it("suppresses the desktop menu, including Shift-right-click", () => {
    const { root, contextMenu } = setup();
    expect(root.hasAttribute("data-desktop")).toBe(true);
    expect(contextMenu("button span").defaultPrevented).toBe(true);
    expect(contextMenu("button span", true).defaultPrevented).toBe(true);
  });

  it("preserves browser menus on the web", () => {
    isTauri.mockReturnValue(false);
    const { root, contextMenu } = setup();
    expect(root.hasAttribute("data-desktop")).toBe(false);
    expect(contextMenu("button span").defaultPrevented).toBe(false);
  });

  it("suppresses the default menu throughout desktop content", () => {
    const { contextMenu } = setup();
    for (const selector of [
      "input",
      "textarea",
      "b",
      "a",
      ".select-text",
      "[data-native-context-menu]",
      "main",
    ]) {
      expect(contextMenu(selector).defaultPrevented).toBe(true);
    }
  });

  it("suppresses the default menu even when text is selected", () => {
    const { root, contextMenu } = setup();
    const range = document.createRange();
    range.selectNodeContents(root.querySelector("main")!);
    const selection = document.getSelection()!;
    selection.addRange(range);
    try {
      expect(contextMenu("button").defaultPrevented).toBe(true);
    } finally {
      selection.removeAllRanges();
    }
  });

  it("suppresses menus on overlays outside the app root", () => {
    setup();
    const overlay = document.createElement("div");
    document.body.append(overlay);
    try {
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      overlay.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    } finally {
      overlay.remove();
    }
  });

  it("lets a custom menu handle right-clicks before suppressing the default", () => {
    const { root, contextMenu } = setup();
    const openMenu = vi.fn((event: Event) => event.preventDefault());
    root.querySelector("main")!.addEventListener("contextmenu", openMenu);
    expect(contextMenu("main").defaultPrevented).toBe(true);
    expect(openMenu).toHaveBeenCalledOnce();
  });
});
