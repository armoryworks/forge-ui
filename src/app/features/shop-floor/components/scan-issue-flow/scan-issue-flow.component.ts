import {
  ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ScanActionService } from '../../../../shared/services/scan-action.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ScanContext, ScanIssueContextJob } from '../../../../shared/models/scan-action.model';
import { InputComponent } from '../../../../shared/components/input/input.component';

type IssueStep = 'select-job' | 'quantity' | 'confirm';

@Component({
  selector: 'app-scan-issue-flow',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent],
  templateUrl: './scan-issue-flow.component.html',
  styleUrl: './scan-issue-flow.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanIssueFlowComponent implements OnInit {
  private readonly scanAction = inject(ScanActionService);
  private readonly snackbar = inject(SnackbarService);

  readonly context = input.required<ScanContext>();
  readonly completed = output<void>();
  readonly cancelled = output<void>();

  protected readonly step = signal<IssueStep>('select-job');
  protected readonly jobs = signal<ScanIssueContextJob[]>([]);
  protected readonly selectedJob = signal<ScanIssueContextJob | null>(null);
  protected readonly issueAll = signal(true);
  protected readonly quantity = signal(0);
  protected readonly submitting = signal(false);
  protected readonly partialQty = new FormControl<number>(0);

  ngOnInit(): void {
    const issueAction = this.context().availableActions.find(a => a.action === 'Issue');
    if (issueAction?.context) {
      this.jobs.set((issueAction.context as { jobs: ScanIssueContextJob[] }).jobs ?? []);
    }

    if (this.jobs().length === 1) {
      this.selectJob(this.jobs()[0]);
    }
  }

  protected selectJob(job: ScanIssueContextJob): void {
    this.selectedJob.set(job);
    this.quantity.set(job.remainingQuantity);
    this.partialQty.setValue(job.remainingQuantity);
    this.step.set('quantity');
  }

  protected selectAll(): void {
    this.issueAll.set(true);
    const job = this.selectedJob();
    if (job) this.quantity.set(job.remainingQuantity);
    this.step.set('confirm');
  }

  protected selectPartial(): void {
    this.issueAll.set(false);
  }

  protected confirmPartial(): void {
    const qty = this.partialQty.value ?? 0;
    const max = this.selectedJob()?.remainingQuantity ?? 0;
    if (qty <= 0 || qty > max) return;
    this.quantity.set(qty);
    this.step.set('confirm');
  }

  protected submit(): void {
    const job = this.selectedJob();
    const ctx = this.context();
    if (!job || !ctx.currentLocationId) return;

    this.submitting.set(true);
    this.scanAction.issue({
      partId: ctx.partId,
      jobId: job.jobId,
      quantity: this.quantity(),
      fromLocationId: ctx.currentLocationId,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.snackbar.success(`Issued ${this.quantity()} x ${ctx.partNumber} to ${job.jobNumber}`);
        this.completed.emit();
      },
      error: () => {
        this.submitting.set(false);
        this.snackbar.error('Issue failed. Please try again.');
      },
    });
  }

  protected back(): void {
    const current = this.step();
    if (current === 'confirm') {
      this.step.set('quantity');
    } else if (current === 'quantity') {
      if (this.jobs().length > 1) {
        this.step.set('select-job');
      } else {
        this.cancelled.emit();
      }
    } else {
      this.cancelled.emit();
    }
  }
}
