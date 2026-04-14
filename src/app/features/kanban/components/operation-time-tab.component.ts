import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { JobCostService } from '../services/job-cost.service';
import { OperationTimeAnalysis } from '../models/operation-time.model';

@Component({
  selector: 'app-operation-time-tab',
  standalone: true,
  imports: [
    DecimalPipe,
    DataTableComponent,
    EmptyStateComponent,
    ColumnCellDirective,
    LoadingBlockDirective,
  ],
  templateUrl: './operation-time-tab.component.html',
  styleUrl: './operation-time-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationTimeTabComponent {
  readonly jobId = input.required<number>();

  private readonly costService = inject(JobCostService);

  readonly loading = signal(false);
  readonly operations = signal<OperationTimeAnalysis[]>([]);

  readonly opColumns: ColumnDef[] = [
    { field: 'operationSequence', header: '#', sortable: true, width: '50px', align: 'center' },
    { field: 'operationName', header: 'Operation', sortable: true },
    { field: 'estimatedSetupMinutes', header: 'Est. Setup', sortable: true, width: '90px', align: 'right' },
    { field: 'actualSetupMinutes', header: 'Act. Setup', sortable: true, width: '90px', align: 'right' },
    { field: 'estimatedRunMinutes', header: 'Est. Run', sortable: true, width: '90px', align: 'right' },
    { field: 'actualRunMinutes', header: 'Act. Run', sortable: true, width: '90px', align: 'right' },
    { field: 'actualTotalMinutes', header: 'Total', sortable: true, width: '80px', align: 'right' },
    { field: 'efficiencyPercent', header: 'Eff.', sortable: true, type: 'number', width: '70px', align: 'right' },
    { field: 'progress', header: 'Progress', width: '120px' },
  ];

  readonly totalEstimated = computed(() => {
    const ops = this.operations();
    return ops.reduce((sum, op) => sum + op.estimatedSetupMinutes + op.estimatedRunMinutes, 0);
  });

  readonly totalActual = computed(() => {
    const ops = this.operations();
    return ops.reduce((sum, op) => sum + op.actualTotalMinutes, 0);
  });

  readonly overallEfficiency = computed(() => {
    const actual = this.totalActual();
    const est = this.totalEstimated();
    return actual > 0 ? (est / actual) * 100 : 0;
  });

  constructor() {
    effect(() => {
      const jobId = this.jobId();
      if (jobId) this.loadData(jobId);
    });
  }

  private loadData(jobId: number): void {
    this.loading.set(true);
    this.costService.getOperationTimeSummary(jobId).subscribe({
      next: (ops) => {
        this.operations.set(ops);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  formatMinutes(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  getVarianceClass(variance: number): string {
    if (variance > 0) return 'op-time__variance--over';
    if (variance < 0) return 'op-time__variance--under';
    return '';
  }

  getEfficiencyClass(efficiency: number): string {
    if (efficiency >= 100) return 'op-time__efficiency--good';
    if (efficiency >= 80) return 'op-time__efficiency--fair';
    return 'op-time__efficiency--poor';
  }

  getEfficiencyBarClass(efficiency: number): string {
    if (efficiency >= 100) return 'op-time__bar-fill--good';
    if (efficiency >= 80) return 'op-time__bar-fill--fair';
    return 'op-time__bar-fill--poor';
  }

  getBarWidth(actual: number, estimated: number): number {
    if (estimated <= 0) return actual > 0 ? 100 : 0;
    return Math.min((actual / estimated) * 100, 150);
  }
}
