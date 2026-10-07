import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';

import { Observable, of, switchMap } from 'rxjs';

import { AuthService } from '../../../shared/services/auth.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';

interface JobDetail {
  id: number;
  jobNumber: string;
  title: string;
  description: string | null;
  stageName: string;
  stageColor: string;
  priorityName: string;
  partNumber: string | null;
  partDescription: string | null;
  customerName: string | null;
  dueDate: string | null;
  isOverdue: boolean;
  notes: string | null;
}

interface ActiveTimer {
  timeEntryId: number;
  jobId: number | null;
  jobNumber: string | null;
  operationId: number | null;
  timerStart: string;
}

@Component({
  selector: 'app-mobile-job-detail',
  standalone: true,
  imports: [DatePipe, LoadingBlockDirective],
  templateUrl: './mobile-job-detail.component.html',
  styleUrl: './mobile-job-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileJobDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly snackbar = inject(SnackbarService);

  protected readonly loading = signal(true);
  protected readonly job = signal<JobDetail | null>(null);
  protected readonly submitting = signal(false);
  protected readonly noteText = signal('');
  protected readonly activeTimer = signal<ActiveTimer | null>(null);

  protected readonly timerOnThisJob = computed(() => {
    const timer = this.activeTimer();
    const j = this.job();
    return !!timer && !!j && timer.jobId === j.id;
  });

  protected readonly timerElsewhere = computed(() => !!this.activeTimer() && !this.timerOnThisJob());

  ngOnInit(): void {
    const jobId = this.route.snapshot.paramMap.get('jobId');
    if (jobId) {
      this.loadJob(+jobId);
      this.loadTimer();
    }
  }

  private loadTimer(): void {
    this.http.get<ActiveTimer | null>('/api/v1/time-tracking/timer/active').subscribe({
      next: (timer) => this.activeTimer.set(timer ?? null),
      error: () => this.activeTimer.set(null),
    });
  }

  private loadJob(jobId: number): void {
    this.loading.set(true);
    this.http.get<JobDetail>(`/api/v1/jobs/${jobId}`).subscribe({
      next: (job) => {
        this.job.set(job);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackbar.error('Failed to load job');
      },
    });
  }

  protected goBack(): void {
    this.router.navigate(['/m/jobs']);
  }

  protected stopTimer(): void {
    if (!this.activeTimer() || this.submitting()) return;

    this.submitting.set(true);
    this.http.post('/api/v1/time-tracking/timer/stop', {}).subscribe({
      next: () => {
        this.submitting.set(false);
        this.snackbar.success('Timer stopped');
        this.loadTimer();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.snackbar.error(this.serverMessage(err, 'Failed to stop timer'));
        this.loadTimer();
      },
    });
  }

  protected startTimer(): void {
    const j = this.job();
    if (!j || this.submitting() || this.timerOnThisJob()) return;

    this.submitting.set(true);
    const stopOther: Observable<unknown> = this.activeTimer()
      ? this.http.post('/api/v1/time-tracking/timer/stop', {})
      : of(null);
    stopOther.pipe(
      switchMap(() => this.http.post('/api/v1/time-tracking/timer/start', { jobId: j.id })),
    ).subscribe({
      next: () => {
        this.submitting.set(false);
        this.snackbar.success('Timer started');
        this.loadTimer();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.snackbar.error(this.serverMessage(err, 'Failed to start timer'));
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

    const userId = this.authService.user()?.id;
    if (!userId) return;

    this.submitting.set(true);
    this.http.post(`/api/v1/jobs/${j.id}/activity`, {
      description: text,
      action: 'Comment',
      userId,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.noteText.set('');
        this.snackbar.success('Note added');
      },
      error: () => {
        this.submitting.set(false);
        this.snackbar.error('Failed to add note');
      },
    });
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
