import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  Renderer2,
  Signal,
  signal,
} from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';

@Component({
  selector: 'app-validation-popover-content',
  standalone: true,
  template: `
    <ul class="validation-popover__list">
      @for (msg of messages(); track msg) {
        <li>{{ msg }}</li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
      background: var(--surface);
      border: 1px solid var(--error);
      padding: 8px 12px;
      font-size: 11px;
      color: var(--error);
      max-width: 300px;
      opacity: 0;
      transition: opacity 300ms ease;
      pointer-events: none;
    }

    :host(.is-visible) { opacity: 1; }

    .validation-popover__list {
      margin: 0;
      padding: 0 0 0 16px;
      list-style: disc;

      li {
        line-height: 1.6;
      }
    }
  `,
  host: { '[class.is-visible]': 'visible()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValidationPopoverContentComponent {
  readonly messages = signal<string[]>([]);
  readonly visible = signal(false);
}

const HIDE_DELAY_MS = 2000;
const FADE_MS = 300;
const AUTO_HIDE_MS = 4000;

@Directive({
  selector: '[appValidationPopover]',
  standalone: true,
})
export class ValidationPopoverDirective implements OnDestroy {
  readonly appValidationPopover = input.required<Signal<string[]>>();

  private readonly overlay = inject(Overlay);
  private readonly elementRef = inject(ElementRef);
  private readonly renderer = inject(Renderer2);
  private overlayRef: OverlayRef | null = null;
  private contentRef: ComponentRef<ValidationPopoverContentComponent> | null = null;
  private removeListeners: (() => void)[] = [];
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private autoHideTimer: ReturnType<typeof setTimeout> | null = null;
  private detachTimer: ReturnType<typeof setTimeout> | null = null;
  private lastViolationsKey: string | null = null;

  constructor() {
    const el = this.elementRef.nativeElement;

    this.removeListeners.push(
      this.renderer.listen(el, 'mouseenter', () => this.show()),
      this.renderer.listen(el, 'focusin', () => this.show()),
      this.renderer.listen(el, 'mouseleave', () => this.scheduleHide(HIDE_DELAY_MS)),
      this.renderer.listen(el, 'focusout', () => this.scheduleHide(HIDE_DELAY_MS)),
    );

    // Auto-show on violation change. First run seeds lastViolationsKey so a
    // freshly-mounted form doesn't pop a popover unsolicited.
    effect(() => {
      const violations = this.appValidationPopover()();
      const key = violations.join('\u0001');

      if (this.lastViolationsKey === null) {
        this.lastViolationsKey = key;
        return;
      }
      if (key === this.lastViolationsKey) return;
      this.lastViolationsKey = key;

      if (violations.length === 0) {
        this.beginFadeOut();
        return;
      }

      this.show();
      this.scheduleAutoHide(AUTO_HIDE_MS);
    });
  }

  private show(): void {
    const violations = this.appValidationPopover()();
    if (violations.length === 0) return;

    this.cancelHide();
    this.cancelAutoHide();
    this.cancelDetach();

    if (this.overlayRef?.hasAttached() && this.contentRef) {
      this.contentRef.instance.messages.set(violations);
      this.contentRef.instance.visible.set(true);
      return;
    }

    this.overlayRef = this.overlay.create({
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(this.elementRef)
        .withPositions([
          { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -4 },
          { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 4 },
        ]),
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
    });

    const portal = new ComponentPortal(ValidationPopoverContentComponent);
    this.contentRef = this.overlayRef.attach(portal);
    this.contentRef.instance.messages.set(violations);

    // Start hidden, flip to visible on next frame so the CSS transition runs.
    requestAnimationFrame(() => this.contentRef?.instance.visible.set(true));
  }

  private scheduleHide(delayMs: number): void {
    this.cancelHide();
    this.hideTimer = setTimeout(() => this.beginFadeOut(), delayMs);
  }

  private scheduleAutoHide(delayMs: number): void {
    this.cancelAutoHide();
    this.autoHideTimer = setTimeout(() => this.beginFadeOut(), delayMs);
  }

  private beginFadeOut(): void {
    this.cancelHide();
    this.cancelAutoHide();
    if (!this.overlayRef?.hasAttached()) return;

    this.contentRef?.instance.visible.set(false);
    this.cancelDetach();
    this.detachTimer = setTimeout(() => this.detachNow(), FADE_MS);
  }

  private detachNow(): void {
    this.overlayRef?.detach();
    this.overlayRef?.dispose();
    this.overlayRef = null;
    this.contentRef = null;
    this.detachTimer = null;
  }

  private cancelHide(): void {
    if (this.hideTimer != null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private cancelAutoHide(): void {
    if (this.autoHideTimer != null) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
  }

  private cancelDetach(): void {
    if (this.detachTimer != null) {
      clearTimeout(this.detachTimer);
      this.detachTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.cancelHide();
    this.cancelAutoHide();
    this.cancelDetach();
    this.detachNow();
    this.removeListeners.forEach((fn) => fn());
  }
}
