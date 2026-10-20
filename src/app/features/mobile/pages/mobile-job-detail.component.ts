import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { Observable, of, switchMap, tap } from 'rxjs';

import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { DetailLoadErrorComponent } from '../../../shared/components/detail-load-error/detail-load-error.component';
import { notFoundError } from '../../../shared/utils/not-found-error';
import { parsePositiveId } from '../../../shared/utils/parse-positive-id';
import { MobileClockStateService } from '../services/mobile-clock-state.service';

interface JobDetail {
  id: number;
  jobNumber: string;
  title: string;
  description: string | null;
  stageName: string;
  stageColor: string;
  priority: string;
  partNumber: string | null;
  customerName: string | null;
  dueDate: string | Date | null;
  completedDate: string | Date | null;
}

interface ActiveTimer {
  timeEntryId: number;
  jobId: number | null;
  jobNumber: string | null;
  operationId: number | null;
  timerStart: string;
}

const PRIORITY_KEYS = new Set(['low', 'normal', 'high', 'urgent']);

@Component({
  selector: 'app-mobile-job-detail',
  standalone: true,
  imports: [DatePipe, TranslatePipe, LoadingBlockDirective, DetailLoadErrorComponent],
  templateUrl: './mobile-job-detail.component.html',
  styleUrl: './mobile-job-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileJobDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly clockState = inject(MobileClockStateService);

  protected readonly loading = signal(true);
  protected readonly job = signal<JobDetail | null>(null);
  protected readonly loadError = signal<unknown>(null);
  protected readonly submitting = signal(false);
  protected readonly noteText = signal('');
  protected readonly activeTimer = signal<ActiveTimer | null>(null);
  protected readonly timerKnown = signal(false);
  protected readonly timerLoadFailed = signal(false);

  protected readonly timerOnThisJob = computed(() => {
    const timer = this.activeTimer();
    const j = this.job();
    return !!timer && !!j && timer.jobId === j.id;
  });

  protected readonly timerElsewhere = computed(() => !!this.activeTimer() && !this.timerOnThisJob());

  protected readonly overdue = computed(() => {
    const j = this.job();
    if (!j?.dueDate || j.completedDate) return false;
    const utcDay = (d: Date) => d.toISOString().slice(0, 10);
    return utcDay(new Date(j.dueDate)) < utcDay(new Date());
  });

  protected readonly priorityKey = computed(() => {
    const priority = this.job()?.priority;
    return priority && PRIORITY_KEYS.has(priority.toLowerCase()) ? `priority.${priority.toLowerCase()}` : null;
  });

  private readonly jobId = parsePositiveId(this.route.snapshot.paramMap.get('jobId'));
  private started = false;

  constructor() {
    if (!this.jobId) {
      this.loadError.set(notFoundError());
      this.loading.set(false);
      return;
    }
    effect(() => {
      if (this.started || !this.clockState.checkDone() || !this.clockState.isClockedIn()) return;
      this.started = true;
      untracked(() => {
        this.reloadJob();
        this.loadTimer();
      });
    });
  }

  protected reloadJob(): void {
    if (this.jobId) this.loadJob(this.jobId);
  }

  private loadTimer(): void {
    this.timerKnown.set(false);
    this.timerLoadFailed.set(false);
    this.http.get<ActiveTimer | null>('/api/v1/time-tracking/timer/active').subscribe({
      next: (timer) => {
        this.activeTimer.set(timer ?? null);
        this.timerKnown.set(true);
      },
      error: () => this.timerLoadFailed.set(true),
    });
  }

  protected retryTimer(): void {
    this.loadTimer();
  }

  private loadJob(jobId: number): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.http.get<JobDetail>(`/api/v1/jobs/${jobId}`).subscribe({
      next: (job) => {
        this.job.set(job);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(err);
        this.loading.set(false);
      },
    });
  }

  protected goBack(): void {
    this.router.navigate(['/m/jobs']);
  }

  protected stopTimer(): void {
    const timer = this.activeTimer();
    if (!timer || this.submitting() || !this.timerKnown()) return;

    this.submitting.set(true);
    this.http.post('/api/v1/time-tracking/timer/stop', { timeEntryId: timer.timeEntryId }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.snackbar.success(this.translate.instant('mobileLegacy.jobDetail.timerStopped'));
        this.loadTimer();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.snackbar.errorFrom(err, 'mobileLegacy.jobDetail.stopFailed');
        this.loadTimer();
      },
    });
  }

  protected startTimer(): void {
    const j = this.job();
    if (!j || this.submitting() || !this.timerKnown() || this.timerOnThisJob()) return;

    this.submitting.set(true);
    const previous = this.activeTimer();
    let stoppedPrevious = false;
    const stopOther: Observable<unknown> = previous
      ? this.http.post('/api/v1/time-tracking/timer/stop', { timeEntryId: previous.timeEntryId })
        .pipe(tap(() => (stoppedPrevious = true)))
      : of(null);
    stopOther.pipe(
      switchMap(() => this.http.post('/api/v1/time-tracking/timer/start', { jobId: j.id })),
    ).subscribe({
      next: () => {
        this.submitting.set(false);
        this.snackbar.success(this.translate.instant('mobileLegacy.jobDetail.timerStarted'));
        this.loadTimer();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        if (stoppedPrevious && previous) {
          const reason = this.serverMessage(err, this.translate.instant('mobileLegacy.jobDetail.startFailed'));
          this.snackbar.error(this.stoppedButNotStarted(previous, reason));
        } else {
          this.snackbar.errorFrom(err, 'mobileLegacy.jobDetail.startFailed');
        }
        this.loadTimer();
      },
    });
  }

  protected onNoteInput(event: Event): void {
    this.noteText.set((event.target as HTMLTextAreaElement).value);
  }

  protected addNote(): void {
    const j = this.job();
    const text = this.noteText().trim();
    if (!j || !text || this.submitting()) return;

    this.submitting.set(true);
    this.http.post(`/api/v1/jobs/${j.id}/notes`, { text }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.noteText.set('');
        this.snackbar.success(this.translate.instant('mobileLegacy.jobDetail.noteAdded'));
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.snackbar.errorFrom(err, 'mobileLegacy.jobDetail.noteFailed');
      },
    });
  }

  private stoppedButNotStarted(previous: ActiveTimer, reason: string): string {
    return previous.jobNumber
      ? this.translate.instant('mobileWeb.timer.stoppedButNotStarted', { jobNumber: previous.jobNumber, reason })
      : this.translate.instant('mobileWeb.timer.stoppedButNotStartedUnknown', { reason });
  }

  private serverMessage(err: unknown, fallback: string): string {
    const body = err instanceof HttpErrorResponse ? err.error : null;
    if (body && typeof body === 'object') {
      const { detail, title } = body as { detail?: unknown; title?: unknown };
      if (typeof detail === 'string' && detail) return detail;
      if (typeof title === 'string' && title) return title;
    }
    if (typeof body === 'string' && body) return body;
    return fallback;
  }
}
