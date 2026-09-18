import { DestroyRef, Directive, inject, signal } from "@angular/core";

@Directive({
  selector: "[appAnimateIcon]",
  exportAs: "appAnimateIcon",
  host: {
    // Keep decorative icons from running the library's own hover/touch handlers.
    class: "[&_[role=img]]:pointer-events-none",
    "(pointerdown)": "play()",
    "(keydown.enter)": "play()",
    "(keydown.space)": "play()",
  },
})
export class AnimateIconDirective {
  readonly animate = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected play() {
    if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    clearTimeout(this.timer);
    this.animate.set(true);
    this.timer = setTimeout(() => this.animate.set(false), 700);
  }
}
