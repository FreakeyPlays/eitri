import { DIALOG_DATA } from "@angular/cdk/dialog";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BrnDialogRef } from "@spartan-ng/brain/dialog";
import { provideSpartanHlm } from "@ui/utils";
import { ProjectService } from "@core/projects/project.service";
import { ProjectSettingsComponent } from "./project-settings.component";

const eitri = {
  id: "ca0dcace-34da-4b44-8364-13ce54a32e44",
  path: "/git/eitri",
  name: "eitri",
  lastOpenedAt: "2026-09-21T10:00:00.000Z",
};

describe("ProjectSettingsComponent", () => {
  const busy = signal(false);
  const error = signal<string | null>(null);
  const rename = vi.fn<(id: string, name: string) => Promise<boolean>>();
  const forget = vi.fn<(id: string) => Promise<boolean>>();
  const close = vi.fn();

  beforeEach(() => {
    busy.set(false);
    error.set(null);
    rename.mockReset().mockResolvedValue(true);
    forget.mockReset().mockResolvedValue(true);
    close.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideSpartanHlm(),
        { provide: BrnDialogRef, useValue: { close, state: signal("open") } },
        { provide: DIALOG_DATA, useValue: { project: eitri } },
        { provide: ProjectService, useValue: { busy, error, rename, forget } },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(ProjectSettingsComponent);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const button = (label: string) =>
      [...element.querySelectorAll<HTMLButtonElement>("button")].find(
        (entry) => entry.textContent?.trim() === label,
      );
    const field = element.querySelector<HTMLInputElement>("input[name=project-name]")!;
    const type = (value: string) => {
      field.value = value;
      field.dispatchEvent(new Event("input"));
      fixture.detectChanges();
    };
    return { fixture, element, button, field, type };
  }

  it("starts from the project's current name and its folder", async () => {
    const { element, field } = await render();

    expect(field.value).toBe("eitri");
    expect(element.textContent).toContain("/git/eitri");
  });

  it("saves a new name and closes", async () => {
    const { button, type } = await render();

    type("  Client portal  ");
    button("Save")!.click();

    await vi.waitFor(() =>
      expect(rename).toHaveBeenCalledExactlyOnceWith(eitri.id, "Client portal"),
    );
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
  });

  it("clears the name when the field is emptied, so the folder's name is used", async () => {
    const { element, button, type } = await render();

    expect(element.textContent).toContain("Leave it empty to fall back to the folder name.");

    type("   ");
    expect(button("Save")!.disabled).toBe(false);
    button("Save")!.click();

    await vi.waitFor(() => expect(rename).toHaveBeenCalledExactlyOnceWith(eitri.id, ""));
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
  });

  it("stores a name matching the folder rather than treating it as a reset", async () => {
    const { button, type } = await render();

    type("eitri");
    button("Save")!.click();

    await vi.waitFor(() => expect(rename).toHaveBeenCalledExactlyOnceWith(eitri.id, "eitri"));
  });

  it("stays open when the backend refuses the new name", async () => {
    rename.mockResolvedValue(false);
    error.set("That project is not in the list.");
    const { element, button, type } = await render();

    type("Renamed");
    button("Save")!.click();

    await vi.waitFor(() => expect(rename).toHaveBeenCalledOnce());
    expect(close).not.toHaveBeenCalled();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain("not in the list");
  });

  it("removes the project only after confirming", async () => {
    const { fixture, element, button } = await render();

    button("Remove Project")!.click();
    fixture.detectChanges();

    expect(forget).not.toHaveBeenCalled();
    expect(element.textContent).toContain("Are you sure");

    button("Yes, delete it!")!.click();
    await vi.waitFor(() => expect(forget).toHaveBeenCalledExactlyOnceWith(eitri.id));
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
  });

  it("holds every action while a request is pending", async () => {
    busy.set(true);
    const { button, field } = await render();

    expect(field.disabled).toBe(true);
    expect(button("Save")!.disabled).toBe(true);
    expect(button("Remove Project")!.disabled).toBe(true);
    expect(rename).not.toHaveBeenCalled();
  });
});
