import { afterNextRender, DestroyRef, Directive, ElementRef, inject, NgZone, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appScrollCue]',
  standalone: true,
})
export class ScrollCueDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.attach()));
  }

  update(): void {
    const host = this.el.nativeElement;
    const overflowStart = host.scrollLeft > 1;
    const overflowEnd = host.scrollLeft + host.clientWidth < host.scrollWidth - 1;
    this.toggle('scroll-cue--start', overflowStart);
    this.toggle('scroll-cue--end', overflowEnd);
  }

  private attach(): void {
    const host = this.el.nativeElement;
    const onScroll = (): void => this.update();
    host.addEventListener('scroll', onScroll, { passive: true });
    this.destroyRef.onDestroy(() => host.removeEventListener('scroll', onScroll));

    if (typeof ResizeObserver !== 'undefined') {
      const resize = new ResizeObserver(() => this.update());
      const observeChildren = (): void => {
        resize.disconnect();
        resize.observe(host);
        Array.from(host.children).forEach(child => resize.observe(child));
      };
      observeChildren();
      this.destroyRef.onDestroy(() => resize.disconnect());

      if (typeof MutationObserver !== 'undefined') {
        const mutations = new MutationObserver(() => {
          observeChildren();
          this.update();
        });
        mutations.observe(host, { childList: true });
        this.destroyRef.onDestroy(() => mutations.disconnect());
      }
    }

    this.update();
  }

  private toggle(className: string, on: boolean): void {
    const host = this.el.nativeElement;
    if (host.classList.contains(className) === on) return;
    if (on) {
      this.renderer.addClass(host, className);
    } else {
      this.renderer.removeClass(host, className);
    }
  }
}
