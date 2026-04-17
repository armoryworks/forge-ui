import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';

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
  hasActiveTimer: boolean;
  activeTimerId: number | null;
  timerStartedAt: string | null;
  notes: string | null;
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

  ngOnInit(): void {
    const jobId = this.route.snapshot.paramMap.get('jobId');
    if (jobId) {
      this.loadJob(+jobId);
    }
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

  protected toggleTimer(): void {
    const j = this.job();
    if (!j || this.submitting()) return;

    const userId = this.authService.user()?.id;
    if (!userId) return;

    this.submitting.set(true);

    if (j.hasActiveTimer && j.activeTimerId) {
      // Stop timer
      this.http.post('/api/v1/time-tracking/timer/stop', {}).subscribe({
        next: () => {
          this.submitting.set(false);
          this.snackbar.success('Timer stopped');
          this.loadJob(j.id);
        },
        error: () => {
          this.submitting.set(false);
          this.snackbar.error('Failed to stop timer');
        },
      });
    } else {
      // Start timer
      this.http.post('/api/v1/time-tracking/timer/start', {
        jobId: j.id,
      }).subscribe({
        next: () => {
          this.submitting.set(false);
          this.snackbar.success('Timer started');
          this.loadJob(j.id);
        },
        error: () => {
          this.submitting.set(false);
          this.snackbar.error('Failed to start timer');
        },
      });
    }
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
}
