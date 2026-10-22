import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe, PercentPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { ToolbarComponent } from '../../../shared/components/toolbar/toolbar.component';
import { CapabilityService } from '../../../shared/services/capability.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { JobCostService } from '../services/job-cost.service';
import { IssueMaterialDialogData } from '../models/issue-material-dialog-data.model';
import { JobCostSummary, MaterialIssue } from '../models/job-cost.model';
import { IssueMaterialDialogComponent } from './issue-material-dialog/issue-material-dialog.component';

const MATERIAL_ISSUE_CAPABILITY = 'CAP-MFG-MATL-ISSUE';

@Component({
  selector: 'app-job-cost-tab',
  standalone: true,
  imports: [
    TranslatePipe,
    CurrencyPipe,
    DecimalPipe,
    PercentPipe,
    EmptyStateComponent,
    LoadingBlockDirective,
    DataTableComponent,
    ColumnCellDirective,
    ToolbarComponent,
  ],
  templateUrl: './job-cost-tab.component.html',
  styleUrl: './job-cost-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobCostTabComponent {
  readonly jobId = input.required<number>();

  private readonly costService = inject(JobCostService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly capabilities = inject(CapabilityService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly returningId = signal<number | null>(null);
  readonly canIssue = computed(() => this.capabilities.isEnabled(MATERIAL_ISSUE_CAPABILITY));
  readonly costSummary = signal<JobCostSummary | null>(null);
  readonly materialIssues = signal<MaterialIssue[]>([]);

  readonly hasCostData = computed(() => {
    const s = this.costSummary();
    return s != null && (s.totalEstimated > 0 || s.totalActual > 0 || s.quotedPrice > 0);
  });

  readonly materialColumns: ColumnDef[] = [
    { field: 'partNumber', header: this.translate.instant('jobCostTab.colPartNumber'), sortable: true, width: '120px' },
    { field: 'partDescription', header: this.translate.instant('common.description'), sortable: true },
    { field: 'quantity', header: this.translate.instant('jobCostTab.colQty'), sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'unitCost', header: this.translate.instant('jobCostTab.colUnitCost'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'totalCost', header: this.translate.instant('common.total'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'issueType', header: this.translate.instant('common.type'), sortable: true, width: '80px' },
    { field: 'issuedAt', header: this.translate.instant('common.date'), sortable: true, type: 'date', width: '120px' },
    { field: 'actions', header: '', width: '60px' },
  ];

  constructor() {
    effect(() => {
      const jobId = this.jobId();
      if (jobId) this.loadData(jobId);
    });
  }

  private loadData(jobId: number): void {
    this.loading.set(true);
    this.costService.getCostSummary(jobId).subscribe({
      next: (summary) => this.costSummary.set(summary),
      error: () => this.loading.set(false),
    });
    this.costService.getMaterialIssues(jobId).subscribe({
      next: (issues) => {
        this.materialIssues.set(issues);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  canReturn(issue: MaterialIssue): boolean {
    return issue.issueType === 'Issue' && !issue.isReturned;
  }

  returnMaterial(issue: MaterialIssue): void {
    if (!this.canReturn(issue) || this.returningId() !== null) return;
    this.returningId.set(issue.id);
    this.costService.returnMaterial(issue.jobId, issue.id).subscribe({
      next: () => {
        this.returningId.set(null);
        this.snackbar.success(this.translate.instant('jobCostTab.returned'));
        this.loadData(this.jobId());
      },
      error: () => this.returningId.set(null),
    });
  }

  openIssueDialog(): void {
    const data: IssueMaterialDialogData = { jobId: this.jobId() };
    this.dialog.open(IssueMaterialDialogComponent, { data, width: '520px' })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(issue => {
        if (issue) this.loadData(this.jobId());
      });
  }

  recalculateCosts(): void {
    this.costService.recalculateCosts(this.jobId()).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('jobCostTab.recalculated'));
        this.loadData(this.jobId());
      },
    });
  }

  getVarianceClass(variance: number): string {
    if (variance > 0) return 'cost-tab__variance--over';
    if (variance < 0) return 'cost-tab__variance--under';
    return '';
  }

  protected issueTypeLabel(issueType: string): string {
    const key = `jobCostTab.issueTypes.${issueType.toLowerCase()}`;
    const text = this.translate.instant(key);
    return text === key ? issueType : text;
  }
}
