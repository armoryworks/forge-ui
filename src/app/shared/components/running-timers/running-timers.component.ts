import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { DurationMsPipe } from '../../pipes/duration-ms.pipe';
import { elapsedMs } from '../../utils/elapsed-ms';
import { secondTicker } from '../../utils/second-ticker';
import { TimeEntry } from '../../../features/time-tracking/models/time-entry.model';

@Component({
  selector: 'app-running-timers',
  standalone: true,
  imports: [TranslatePipe, DurationMsPipe],
  templateUrl: './running-timers.component.html',
  styleUrl: './running-timers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunningTimersComponent {
  readonly timers = input<TimeEntry[]>([]);
  readonly clockOffsetMs = input(0);
  readonly stoppingId = input<number | null>(null);
  readonly stopRequested = output<number>();

  private readonly now = secondTicker();

  protected readonly items = computed(() => {
    const now = this.now() + this.clockOffsetMs();
    return this.timers()
      .filter(t => t.timerStart && !t.timerStop)
      .map(entry => ({
        entry,
        elapsedMs: elapsedMs(entry.timerStart, now),
        label: entry.operationTitle ?? entry.category ?? null,
      }));
  });
}
