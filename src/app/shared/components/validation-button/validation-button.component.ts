import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  Signal,
  signal,
} from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';

const OUTSIDE_CLICK_DEBOUNCE_MS = 150;
const AUTO_CLOSE_AFTER_CLEAR_MS = 1200;

@Component({
  selector: 'app-validation-button',
  standalone: true,
  imports: [OverlayModule, MatTooltipModule],
  templateUrl: './validation-button.component.html',
  styleUrl: './validation-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValidationButtonComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly violations = input.required<Signal<string[]>>();
  readonly loading = input<boolean, unknown>(false, { transform: (v: unknown) => !!v });

  protected readonly open = signal(false);

  protected readonly violationList = computed(() => this.violations()());
  protected readonly count = computed(() => this.violationList().length);
  protected readonly showTrigger = computed(() => this.count() > 0 && !this.loading());

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start',  originY: 'center', overlayX: 'end',    overlayY: 'center', offsetX: -8 },
    { originX: 'end',    originY: 'center', overlayX: 'start',  overlayY: 'center', offsetX: 8 },
    { originX: 'end',    originY: 'bottom', overlayX: 'end',    overlayY: 'top', offsetY: 8 },
    { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
    { originX: 'start',  originY: 'bottom', overlayX: 'start',  overlayY: 'top', offsetY: 8 },
    { originX: 'end',    originY: 'top', overlayX: 'end',    overlayY: 'bottom', offsetY: -8 },
    { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
    { originX: 'start',  originY: 'top', overlayX: 'start',  overlayY: 'bottom', offsetY: -8 },
  ];

  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Auto-close after violations clear, so the user sees the "all-clear" for a moment.
    effect(() => {
      const count = this.count();
      if (!this.open()) return;
      if (count === 0) {
        this.scheduleClose(AUTO_CLOSE_AFTER_CLEAR_MS);
      } else {
        this.cancelScheduledClose();
      }
    });

    this.destroyRef.onDestroy(() => this.cancelScheduledClose());
  }

  protected toggle(): void {
    if (this.open()) {
      this.close();
    } else if (this.count() > 0) {
      this.open.set(true);
    }
  }

  protected close(): void {
    this.cancelScheduledClose();
    this.open.set(false);
  }

  protected onOutsideClick(): void {
    this.scheduleClose(OUTSIDE_CLICK_DEBOUNCE_MS);
  }

  private scheduleClose(delayMs: number): void {
    this.cancelScheduledClose();
    this.closeTimer = setTimeout(() => {
      this.open.set(false);
      this.closeTimer = null;
    }, delayMs);
  }

  private cancelScheduledClose(): void {
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }
}
