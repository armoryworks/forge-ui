import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

/**
 * A job's percent complete as a slim bar and a whole number, for the jobs table. Empty when the
 * job has no routing to measure; the value is clamped to 0–100 for the bar.
 */
@Component({
  selector: 'app-job-percent-complete',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './job-percent-complete.component.html',
  styleUrl: './job-percent-complete.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobPercentCompleteComponent {
  readonly percent = input<number | null | undefined>(null);

  protected readonly value = computed(() => {
    const percent = this.percent();
    return percent === null || percent === undefined || Number.isNaN(percent)
      ? null
      : Math.min(100, Math.max(0, Math.floor(percent)));
  });

  protected readonly complete = computed(() => this.value() === 100);
}
