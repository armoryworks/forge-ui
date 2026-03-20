import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { LoadingService, LoadingCause } from '../../services/loading.service';

interface DisplayCause extends LoadingCause {
  state: 'entering' | 'visible' | 'exiting';
  exitDirection: 'left' | 'right';
}

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './loading-overlay.component.html',
  styleUrl: './loading-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingOverlayComponent {
  private readonly loadingService = inject(LoadingService);
  private exitCounter = 0;

  protected readonly visible = this.loadingService.isLoading;
  protected readonly displayCauses = signal<DisplayCause[]>([]);

  constructor() {
    effect(() => {
      const active = this.loadingService.causes();
      this.reconcile(active);
    });
  }

  private reconcile(active: readonly LoadingCause[]): void {
    const current = untracked(this.displayCauses);
    const activeKeys = new Set(active.map(c => c.key));

    const updated: DisplayCause[] = [];

    // Carry over items already exiting (mid-animation)
    for (const dc of current) {
      if (dc.state === 'exiting') {
        updated.push(dc);
      }
    }

    // Mark removed active/entering/visible items as exiting
    for (const dc of current) {
      if (dc.state !== 'exiting' && !activeKeys.has(dc.key)) {
        const direction = this.exitCounter % 2 === 0 ? 'left' : 'right';
        this.exitCounter++;
        const exiting: DisplayCause = { ...dc, state: 'exiting', exitDirection: direction };
        updated.push(exiting);

        const exitKey = dc.key;
        setTimeout(() => {
          this.displayCauses.update(causes =>
            causes.filter(c => !(c.key === exitKey && c.state === 'exiting'))
          );
        }, 400);
      }
    }

    // Keep existing active items, add new ones
    for (const cause of active) {
      const existing = current.find(c => c.key === cause.key && c.state !== 'exiting');
      if (existing) {
        updated.push(existing);
      } else {
        const entering: DisplayCause = { ...cause, state: 'entering', exitDirection: 'left' };
        updated.push(entering);

        const enterKey = cause.key;
        setTimeout(() => {
          this.displayCauses.update(causes =>
            causes.map(c => c.key === enterKey && c.state === 'entering'
              ? { ...c, state: 'visible' }
              : c
            )
          );
        }, 50);
      }
    }

    this.displayCauses.set(updated);
  }

  protected getCauseClass(cause: DisplayCause): string {
    if (cause.state === 'entering') return 'loading-overlay__cause--enter';
    if (cause.state === 'exiting') return `loading-overlay__cause--exit-${cause.exitDirection}`;
    return '';
  }
}
