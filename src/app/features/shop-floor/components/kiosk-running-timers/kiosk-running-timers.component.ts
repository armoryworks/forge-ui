import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { DurationMsPipe } from '../../../../shared/pipes/duration-ms.pipe';
import { RunningTimer } from '../../models/running-timer.model';
import { RunningTimerCycles } from '../../models/running-timer-cycles.model';
import { KioskCycleTrackerService } from '../../services/kiosk-cycle-tracker.service';

export const STALE_TIMER_MS = 10 * 60 * 60 * 1000;

interface RunningTimerLine {
  timer: RunningTimer;
  stepLabel: string | null;
  elapsedMs: number;
  stale: boolean;
  isStep: boolean;
  cycle: { remainingMs: number; pending: number } | null;
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
  readonly recordCycles = output<RunningTimerCycles>();

  protected readonly expandedId = signal<number | null>(null);
  private readonly cycleTracker = inject(KioskCycleTrackerService);

  private readonly baselineEffect = effect(() => {
    const timers = this.timers();
    const now = untracked(this.now);
    untracked(() => this.cycleTracker.seed(
      timers.filter(t => cycleMs(t) !== null).map(t => ({ timerId: t.id, cycle: cycleIndex(t, now) })), now));
  });

  protected readonly lines = computed<RunningTimerLine[]>(() => {
    const now = this.now();
    const baselines = this.cycleTracker.baselines();
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
          cycle: cycleOf(timer, now, baselines.get(timer.id)),
        };
      });
  });

  protected toggle(line: RunningTimerLine): void {
    if (!line.isStep) return;
    this.expandedId.update(id => id === line.timer.id ? null : line.timer.id);
  }

  protected recordCycle(line: RunningTimerLine): void {
    const pending = line.cycle?.pending ?? 0;
    if (pending <= 0) return;
    this.recordCycles.emit({ timer: line.timer, cycles: pending });
  }

  protected act(kind: 'stop' | 'record' | 'done', timer: RunningTimer): void {
    this.expandedId.set(null);
    if (kind === 'stop') this.stop.emit(timer);
    else if (kind === 'record') this.recordPieces.emit(timer);
    else this.stopDone.emit(timer);
  }
}

function cycleMs(timer: RunningTimer): number | null {
  const minutes = timer.cycleMinutes;
  return timer.entryType === 'Run' && minutes != null && minutes > 0 ? minutes * 60_000 : null;
}

function cycleIndex(timer: RunningTimer, now: number): number {
  const length = cycleMs(timer);
  if (length === null || timer.timerStart == null) return 0;
  return Math.floor(Math.max(0, now - Date.parse(timer.timerStart)) / length);
}

function cycleOf(timer: RunningTimer, now: number, baseline: number | undefined): { remainingMs: number; pending: number } | null {
  const length = cycleMs(timer);
  if (length === null || timer.timerStart == null) return null;
  const elapsed = Math.max(0, now - Date.parse(timer.timerStart));
  const index = Math.floor(elapsed / length);
  return {
    remainingMs: Math.ceil((length - (elapsed % length)) / 1000) * 1000,
    pending: baseline === undefined ? 0 : Math.max(0, index - baseline),
  };
}
