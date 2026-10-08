import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { DurationMsPipe } from '../../../../shared/pipes/duration-ms.pipe';
import { RunningTimer } from '../../models/running-timer.model';

interface RunningTimerLine {
  timer: RunningTimer;
  stepLabel: string | null;
  elapsedMs: number;
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

  protected readonly lines = computed<RunningTimerLine[]>(() => {
    const now = this.now();
    return this.timers()
      .filter(timer => timer.timerStart != null)
      .map(timer => ({
        timer,
        stepLabel: timer.operationStepNumber != null
          ? `${timer.operationStepNumber} · ${timer.operationTitle ?? ''}`.trim()
          : null,
        elapsedMs: Math.max(0, Math.round((now - Date.parse(timer.timerStart as string)) / 1000) * 1000),
      }));
  });
}
