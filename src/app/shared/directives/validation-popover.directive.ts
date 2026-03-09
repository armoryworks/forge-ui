import {
  Directive,
  ElementRef,
  inject,
  input,
  OnDestroy,
  Renderer2,
  Signal,
} from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-validation-popover-content',
  standalone: true,
  template: `
    <ul class="validation-popover__list">
      @for (msg of messages; track msg) {
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
    }

    .validation-popover__list {
      margin: 0;
      padding: 0 0 0 16px;
      list-style: disc;

      li {
        line-height: 1.6;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValidationPopoverContentComponent {
  messages: string[] = [];
}

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
  private removeListeners: (() => void)[] = [];

  constructor() {
    const el = this.elementRef.nativeElement;

    this.removeListeners.push(
      this.renderer.listen(el, 'mouseenter', () => this.show()),
      this.renderer.listen(el, 'focusin', () => this.show()),
      this.renderer.listen(el, 'mouseleave', () => this.hide()),
      this.renderer.listen(el, 'focusout', () => this.hide()),
    );
  }

  private show(): void {
    const violations = this.appValidationPopover()();
    const el = this.elementRef.nativeElement as HTMLElement;

    if (!el.hasAttribute('disabled') || violations.length === 0) {
      return;
    }

    if (this.overlayRef?.hasAttached()) {
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
    const ref = this.overlayRef.attach(portal);
    ref.instance.messages = violations;
  }

  private hide(): void {
    this.overlayRef?.detach();
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }

  ngOnDestroy(): void {
    this.hide();
    this.removeListeners.forEach((fn) => fn());
  }
}
