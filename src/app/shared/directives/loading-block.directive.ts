import {
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  Renderer2,
} from '@angular/core';

@Directive({
  selector: '[appLoadingBlock]',
  standalone: true,
})
export class LoadingBlockDirective {
  private readonly el = inject(ElementRef);
  private readonly renderer = inject(Renderer2);
  private overlay: HTMLElement | null = null;

  readonly appLoadingBlock = input.required<boolean>();

  constructor() {
    effect(() => {
      const isLoading = this.appLoadingBlock();
      if (isLoading) {
        this.showOverlay();
      } else {
        this.removeOverlay();
      }
    });
  }

  private showOverlay(): void {
    if (this.overlay) return;

    const host = this.el.nativeElement as HTMLElement;
    this.renderer.setStyle(host, 'position', 'relative');

    this.overlay = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setStyle(this.overlay, 'position', 'absolute');
    this.renderer.setStyle(this.overlay, 'inset', '0');
    this.renderer.setStyle(this.overlay, 'display', 'flex');
    this.renderer.setStyle(this.overlay, 'align-items', 'center');
    this.renderer.setStyle(this.overlay, 'justify-content', 'center');
    this.renderer.setStyle(this.overlay, 'background', 'rgba(255, 255, 255, 0.6)');
    this.renderer.setStyle(this.overlay, 'z-index', '10');
    this.renderer.setStyle(this.overlay, 'opacity', '0');
    this.renderer.setStyle(this.overlay, 'transition', 'opacity 300ms ease');

    const spinner = this.renderer.createElement('span') as HTMLElement;
    this.renderer.addClass(spinner, 'material-icons-outlined');
    this.renderer.setStyle(spinner, 'font-size', '24px');
    this.renderer.setStyle(spinner, 'color', 'var(--text-muted)');
    this.renderer.setStyle(spinner, 'animation', 'spin 1s linear infinite');
    const text = this.renderer.createText('refresh');
    this.renderer.appendChild(spinner, text);
    this.renderer.appendChild(this.overlay, spinner);

    this.renderer.appendChild(host, this.overlay);

    // Trigger fade-in
    requestAnimationFrame(() => {
      if (this.overlay) {
        this.renderer.setStyle(this.overlay, 'opacity', '1');
      }
    });
  }

  private removeOverlay(): void {
    if (!this.overlay) return;

    const overlay = this.overlay;
    this.renderer.setStyle(overlay, 'opacity', '0');

    setTimeout(() => {
      if (overlay.parentNode) {
        this.renderer.removeChild(overlay.parentNode, overlay);
      }
    }, 300);

    this.overlay = null;
  }
}
