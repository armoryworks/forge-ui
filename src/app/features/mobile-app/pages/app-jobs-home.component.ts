import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '@ngx-translate/core';

import { MobileTimerService } from '../../../shared/services/mobile-timer.service';
import { RunningJob } from '../models/running-job.model';

/**
 * The Jobs tab without a job in hand: point at Scan or Lookup. With
 * operation tracking on, the jobs the person has timers running on are
 * listed first, each opening its Job Status; the strip above the tab bar
 * stops them.
 */
@Component({
  selector: 'app-app-jobs-home',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './app-jobs-home.component.html',
  styleUrl: './app-jobs-home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppJobsHomeComponent {
  private readonly timer = inject(MobileTimerService);

  protected readonly runningJobs = computed<RunningJob[]>(() => {
    if (!this.timer.operationTracking()) return [];
    const jobs = new Map<number, RunningJob>();
    const general = this.timer.active();
    if (general?.jobId != null) {
      jobs.set(general.jobId, { jobId: general.jobId, jobNumber: general.jobNumber ?? '', jobLevel: true, steps: [] });
    }
    for (const running of this.timer.operationTimers()) {
      if (running.jobId === null) continue;
      const job = jobs.get(running.jobId)
        ?? { jobId: running.jobId, jobNumber: running.jobNumber ?? '', jobLevel: false, steps: [] };
      job.steps.push(`${running.operationStepNumber ?? ''} ${running.operationTitle ?? ''}`.trim());
      jobs.set(running.jobId, job);
    }
    return [...jobs.values()];
  });
}
