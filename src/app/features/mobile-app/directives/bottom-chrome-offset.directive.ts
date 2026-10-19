import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';

export const BOTTOM_CHROME_OFFSET_PROPERTY = '--app-shell-bottom-offset';

/**
 * Publishes the height of the shell's fixed bottom chrome (timer strips and
 * tab bar) as a root CSS property, so toasts can sit above it instead of
 * covering a Stop button.
 */
@Directive({
  selector: '[appBottomChromeOffset]',
  standalone: true,
})
export class BottomChromeOffsetDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly root = inject(DOCUMENT).documentElement;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.publish();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.publish());
      observer.observe(this.el.nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
    destroyRef.onDestroy(() => this.root.style.removeProperty(BOTTOM_CHROME_OFFSET_PROPERTY));
  }

  private publish(): void {
    const height = this.el.nativeElement.getBoundingClientRect().height;
    this.root.style.setProperty(BOTTOM_CHROME_OFFSET_PROPERTY, `${Math.round(height)}px`);
  }
}
