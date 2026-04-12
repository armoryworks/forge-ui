import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe, PercentPipe } from '@angular/common';

import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { ToolbarComponent } from '../../../shared/components/toolbar/toolbar.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { JobCostService } from '../services/job-cost.service';
import { JobCostSummary, MaterialIssue } from '../models/job-cost.model';

@Component({
  selector: 'app-job-cost-tab',
  standalone: true,
  imports: [
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

  readonly loading = signal(false);
  readonly costSummary = signal<JobCostSummary | null>(null);
  readonly materialIssues = signal<MaterialIssue[]>([]);

  readonly hasCostData = computed(() => {
    const s = this.costSummary();
    return s != null && (s.totalEstimated > 0 || s.totalActual > 0 || s.quotedPrice > 0);
  });

  readonly materialColumns: ColumnDef[] = [
    { field: 'partNumber', header: 'Part #', sortable: true, width: '120px' },
    { field: 'partDescription', header: 'Description', sortable: true },
    { field: 'quantity', header: 'Qty', sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'unitCost', header: 'Unit Cost', sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'totalCost', header: 'Total', sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'issueType', header: 'Type', sortable: true, width: '80px' },
    { field: 'issuedAt', header: 'Date', sortable: true, type: 'date', width: '120px' },
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

  returnMaterial(issue: MaterialIssue): void {
    this.costService.returnMaterial(issue.jobId, issue.id).subscribe({
      next: () => {
        this.snackbar.success('Material returned to stock');
        this.loadData(this.jobId());
      },
    });
  }

  recalculateCosts(): void {
    this.costService.recalculateCosts(this.jobId()).subscribe({
      next: () => {
        this.snackbar.success('Costs recalculated');
        this.loadData(this.jobId());
      },
    });
  }

  getVarianceClass(variance: number): string {
    if (variance > 0) return 'cost-tab__variance--over';
    if (variance < 0) return 'cost-tab__variance--under';
    return '';
  }
}
