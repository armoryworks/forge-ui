import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { DurationMsPipe } from '../../../../shared/pipes/duration-ms.pipe';
import { RunningTimer } from '../../models/running-timer.model';

export const STALE_TIMER_MS = 10 * 60 * 60 * 1000;

interface RunningTimerLine {
  timer: RunningTimer;
  stepLabel: string | null;
  elapsedMs: number;
  stale: boolean;
  isStep: boolean;
}

@Component({
  selector: 'app-kiosk-running-timers',
  standalone: true,
  imports: [TranslatePipe, DurationMsPipe],
  templateUrl: './kiosk-running-timers.component.html',
  styleUrl: './kiosk-running-timers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KioskRunningTimersComponent {
  readonly timers = input.required<RunningTimer[]>();
  readonly now = input.required<number>();
  readonly busy = input(false);

  readonly stop = output<RunningTimer>();
  readonly recordPieces = output<RunningTimer>();
  readonly stopDone = output<RunningTimer>();

  protected readonly expandedId = signal<number | null>(null);

  protected readonly lines = computed<RunningTimerLine[]>(() => {
    const now = this.now();
    return this.timers()
      .filter(timer => timer.timerStart != null)
      .map(timer => {
        const elapsedMs = Math.max(0, Math.round((now - Date.parse(timer.timerStart as string)) / 1000) * 1000);
        return {
          timer,
          stepLabel: timer.operationStepNumber != null
            ? `${timer.operationStepNumber} · ${timer.operationTitle ?? ''}`.trim()
            : null,
          elapsedMs,
          stale: elapsedMs >= STALE_TIMER_MS,
          isStep: timer.operationId != null && timer.jobId != null,
        };
      });
  });

  protected toggle(line: RunningTimerLine): void {
    if (!line.isStep) return;
    this.expandedId.update(id => id === line.timer.id ? null : line.timer.id);
  }

  protected act(kind: 'stop' | 'record' | 'done', timer: RunningTimer): void {
    this.expandedId.set(null);
    if (kind === 'stop') this.stop.emit(timer);
    else if (kind === 'record') this.recordPieces.emit(timer);
    else this.stopDone.emit(timer);
  }
}
