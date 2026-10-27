import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, OnInit, output, signal, untracked,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ScanActionService } from '../../../../shared/services/scan-action.service';
import { ScannerService } from '../../../../shared/services/scanner.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ScanContext, ScanIssueContextJob } from '../../../../shared/models/scan-action.model';
import { ScanIssueContext } from '../../../../shared/models/scan-issue-context.model';
import { ScanIssueSource } from '../../../../shared/models/scan-issue-source.model';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';

type IssueStep = 'select-job' | 'source' | 'quantity' | 'confirm';

@Component({
  selector: 'app-scan-issue-flow',
  standalone: true,
  imports: [DateOnlyPipe, ReactiveFormsModule, TranslatePipe, InputComponent],
  templateUrl: './scan-issue-flow.component.html',
  styleUrl: './scan-issue-flow.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanIssueFlowComponent implements OnInit {
  private readonly scanAction = inject(ScanActionService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly scanner = inject(ScannerService);

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
  protected readonly sources = signal<ScanIssueSource[]>([]);
  protected readonly sourcesLoading = signal(false);
  protected readonly selectedSource = signal<ScanIssueSource | null>(null);
  protected readonly sourceCode = new FormControl('');
  protected readonly sourceNotice = signal<string | null>(null);
  protected readonly maxQuantity = computed(() => Math.min(
    this.selectedJob()?.remainingQuantity ?? 0,
    this.selectedSource()?.availableQuantity ?? 0));

  private readonly scanEffect = effect(() => {
    const scan = this.scanner.lastScan();
    if (!scan || this.step() !== 'source') return;
    untracked(() => {
      this.scanner.clearLastScan();
      this.useCode(scan.value);
    });
  });

  ngOnInit(): void {
    const issueAction = this.context().availableActions.find(a => a.action === 'Issue');
    this.jobs.set((issueAction?.context as ScanIssueContext | null | undefined)?.jobs ?? []);

    if (this.jobs().length === 1) {
      this.selectJob(this.jobs()[0]);
    }
  }

  protected selectJob(job: ScanIssueContextJob): void {
    this.selectedJob.set(job);
    this.selectedSource.set(null);
    this.sourceNotice.set(null);
    this.step.set('source');
    this.sourcesLoading.set(true);
    this.scanAction.getIssueSources(this.context().partId).subscribe({
      next: sources => {
        this.sourcesLoading.set(false);
        this.sources.set(sources);
        this.selectedSource.set(sources[0] ?? null);
      },
      error: (err: unknown) => {
        this.sourcesLoading.set(false);
        this.sources.set([]);
        this.snackbar.errorFrom(err, 'kioskFlows.issue.sourcesFailed');
      },
    });
  }

  protected chooseSource(source: ScanIssueSource): void {
    this.selectedSource.set(source);
    this.sourceNotice.set(null);
  }

  protected useTypedCode(): void {
    const code = this.sourceCode.value?.trim();
    if (code) this.useCode(code);
  }

  protected useCode(code: string): void {
    const wanted = code.trim().toLowerCase();
    const match = this.sources().find(s => s.lotNumber?.toLowerCase() === wanted)
      ?? this.sources().find(s => s.locationBarcode?.toLowerCase() === wanted);
    if (!match) {
      this.sourceNotice.set(this.translate.instant('kioskFlows.issue.sourceNotEligible', { code: code.trim() }));
      return;
    }
    this.sourceCode.reset();
    this.chooseSource(match);
    this.continueToQuantity();
  }

  protected continueToQuantity(): void {
    if (!this.selectedSource()) return;
    const max = this.maxQuantity();
    this.issueAll.set(true);
    this.quantity.set(max);
    this.partialQty.setValue(max);
    this.step.set('quantity');
  }

  protected selectAll(): void {
    this.issueAll.set(true);
    this.quantity.set(this.maxQuantity());
    this.step.set('confirm');
  }

  protected selectPartial(): void {
    this.issueAll.set(false);
  }

  protected confirmPartial(): void {
    const qty = this.partialQty.value ?? 0;
    if (qty <= 0 || qty > this.maxQuantity()) return;
    this.quantity.set(qty);
    this.step.set('confirm');
  }

  protected submit(): void {
    const job = this.selectedJob();
    const source = this.selectedSource();
    const ctx = this.context();
    if (!job || !source || this.submitting()) return;

    this.submitting.set(true);
    this.scanAction.issue({
      partId: ctx.partId,
      jobId: job.jobId,
      quantity: this.quantity(),
      fromLocationId: source.locationId,
      binContentId: source.binContentId,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.snackbar.success(this.translate.instant('kioskFlows.issue.success', {
          quantity: this.quantity(),
          part: ctx.partNumber,
          workOrder: job.jobNumber,
        }));
        this.completed.emit();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.snackbar.errorFrom(err, 'kioskFlows.issue.failed');
      },
    });
  }

  protected back(): void {
    const current = this.step();
    if (current === 'confirm') {
      this.step.set('quantity');
    } else if (current === 'quantity') {
      this.step.set('source');
    } else if (current === 'source') {
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
