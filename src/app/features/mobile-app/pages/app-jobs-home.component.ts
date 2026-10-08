import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { TranslatePipe } from '@ngx-translate/core';

import { InputComponent } from '../../../shared/components/input/input.component';
import { DateOnlyPipe } from '../../../shared/pipes/date-only.pipe';
import { MyJob } from '../../../shared/models/my-job.model';
import { InstanceService } from '../../../shared/services/instance.service';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
import { MobileTimerService } from '../../../shared/services/mobile-timer.service';
import { SharedIdentityService } from '../../../shared/services/shared-identity.service';
import { IdentityPromptComponent } from '../identity/identity-prompt.component';
import { RunningJob } from '../models/running-job.model';

/**
 * The Jobs tab: Scan at the top; with operation tracking on, the jobs the
 * person has timers running on, each opening its Job Status (the strip
 * above the tab bar stops them); then "My work orders" — the open jobs
 * assigned to the person, searchable by job, title or part, each marked
 * when overdue or when the person's timer runs on it. A row opens Job
 * Status. On a shared device the person identifies before the list loads.
 */
@Component({
  selector: 'app-app-jobs-home',
  standalone: true,
  imports: [DateOnlyPipe, RouterLink, ReactiveFormsModule, TranslatePipe, InputComponent, IdentityPromptComponent],
  templateUrl: './app-jobs-home.component.html',
  styleUrl: './app-jobs-home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppJobsHomeComponent {
  private readonly api = inject(MobileApiService);
  private readonly instances = inject(InstanceService);
  private readonly identity = inject(SharedIdentityService);
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

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly search = toSignal(this.searchControl.valueChanges, { initialValue: '' });

  protected readonly jobs = signal<MyJob[]>([]);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly identifying = signal(false);

  protected readonly needsIdentity = computed(() =>
    !!this.instances.instance()?.shared && !this.identity.identified());

  protected readonly visibleJobs = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.jobs();
    return this.jobs().filter((job) =>
      [job.jobNumber, job.title, job.partNumber ?? ''].some((value) => value.toLowerCase().includes(term)));
  });

  constructor() {
    effect(() => {
      const needsIdentity = this.needsIdentity();
      untracked(() => {
        if (needsIdentity) this.jobs.set([]);
        else this.load();
      });
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.api.myJobs().subscribe({
      next: (jobs) => { this.jobs.set(jobs); this.loading.set(false); },
      error: () => { this.failed.set(true); this.loading.set(false); },
    });
  }

  protected identify(): void {
    this.identifying.set(true);
  }

  protected onIdentified(): void {
    this.identifying.set(false);
  }
}
