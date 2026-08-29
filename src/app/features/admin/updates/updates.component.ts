import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { InputComponent } from '../../../shared/components/input/input.component';
import { DeployAvailability, DeployJob, DeployState } from './models/update.model';
import { UpdatesService } from './services/updates.service';

const POLL_MS = 2000;

/**
 * Admin Updates — what this install is running, and the button that moves it.
 *
 * The one screen that must survive its own backend being replaced: polling
 * fails mid-upgrade because forge-api is one of the containers going down. That
 * is expected, so a failed poll holds the last known state and keeps trying
 * instead of showing an error.
 */
@Component({
  selector: 'app-admin-updates',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, TranslatePipe, InputComponent],
  templateUrl: './updates.component.html',
  styleUrl: './updates.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdatesComponent implements OnInit, OnDestroy {
  private readonly updates = inject(UpdatesService);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private logOffset = 0;

  protected readonly state = signal<DeployState | null>(null);
  protected readonly availability = signal<DeployAvailability | null>(null);
  protected readonly job = signal<DeployJob | null>(null);
  protected readonly log = signal('');
  protected readonly checking = signal(false);
  protected readonly starting = signal(false);
  protected readonly error = signal<string | null>(null);
  /** The destructive-schema gate. Typing APPLY is the whole confirmation. */
  protected readonly approvalForm = new FormGroup({ confirmWord: new FormControl('', { nonNullable: true }) });
  protected readonly apiReachable = signal(true);

  protected readonly agentAvailable = computed(() => this.state()?.agentAvailable !== false);
  protected readonly running = computed(() => this.job()?.state === 'running');
  protected readonly halted = computed(() => this.job()?.state === 'halted-destructive');
  protected readonly approval = computed(() => this.job()?.needsApproval ?? null);
  protected readonly partial = computed(() => this.job()?.partial ?? null);

  /** More than one step means a split install, and the per-box breakdown is worth showing. */
  protected readonly crossBox = computed(() => (this.job()?.steps?.length ?? 0) > 1);

  ngOnInit(): void {
    this.refreshState();
    this.check();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  protected check(): void {
    this.checking.set(true);
    this.updates.getAvailability().subscribe({
      next: (a) => {
        this.availability.set(a);
        this.checking.set(false);
      },
      error: () => {
        this.availability.set(null);
        this.checking.set(false);
      },
    });
  }

  protected upgrade(): void {
    this.start({ action: 'update' });
  }

  protected approveDestructive(): void {
    if (!this.confirmed()) return;
    this.start({
      action: 'updateApprove',
      confirm: 'APPLY',
      approvedFromJobId: this.job()?.id ?? null,
    });
    this.approvalForm.reset();
  }

  protected confirmed(): boolean {
    return this.approvalForm.controls.confirmWord.value.trim() === 'APPLY';
  }

  protected rollback(): void {
    this.start({ action: 'rollback' });
  }

  private start(body: Parameters<UpdatesService['startJob']>[0]): void {
    this.starting.set(true);
    this.error.set(null);
    this.log.set('');
    this.logOffset = 0;
    this.updates.startJob(body).subscribe({
      next: (job) => {
        this.job.set(job);
        this.starting.set(false);
        this.startPolling();
      },
      error: (e: { error?: { error?: string }; status?: number }) => {
        this.starting.set(false);
        this.error.set(e.error?.error ?? `HTTP ${e.status ?? 0}`);
      },
    });
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => this.pollJob(), POLL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private pollJob(): void {
    const current = this.job();
    if (!current) return;

    this.updates.getJob(current.id).subscribe({
      next: (job) => {
        this.apiReachable.set(true);
        this.job.set(job);
        this.pullLog(job);
        if (job.state !== 'running') {
          this.stopPolling();
          this.refreshState();
          this.check();
        }
      },
      // The API being unreachable here is the upgrade working, not a failure.
      // Hold the last known state and keep polling; it comes back.
      error: () => this.apiReachable.set(false),
    });
  }

  private pullLog(job: DeployJob): void {
    if (job.logSize <= this.logOffset) return;
    this.updates.getJobLog(job.id, this.logOffset).subscribe({
      next: (chunk) => {
        if (!chunk) return;
        this.logOffset += new TextEncoder().encode(chunk).length;
        this.log.update((prev) => prev + chunk);
      },
      error: () => undefined,
    });
  }

  private refreshState(): void {
    this.updates.getState().subscribe({
      next: (s) => {
        this.apiReachable.set(true);
        this.state.set(s);
        if (s.runningJob && !this.job()) {
          this.job.set(s.runningJob);
          this.startPolling();
        }
      },
      error: () => this.apiReachable.set(false),
    });
  }
}
