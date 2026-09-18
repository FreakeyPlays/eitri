import { TestBed } from "@angular/core/testing";
import { HlmDialogService } from "@ui/dialog";
import { provideSpartanHlm } from "@ui/utils";
import { openAddProjectDialog } from "./add-project-dialog.component";

describe("AddProjectDialogComponent", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideSpartanHlm()] });
  });

  it.each(["Cancel", "Add Project"])("closes on %s", async (action) => {
    openAddProjectDialog(TestBed.inject(HlmDialogService));
    const dialog = await vi.waitFor(() => {
      const opened = document.querySelector('[role="dialog"]');
      expect(opened?.textContent).toContain("Add a project");
      return opened!;
    });
    expect(dialog.getAttribute("aria-labelledby")).toBe(dialog.querySelector("h2")!.id);
    const buttons = Array.from(dialog.querySelectorAll("button"));
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(["Cancel", "Add Project"]);
    buttons.find((button) => button.textContent?.trim() === action)!.click();
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  });
});
