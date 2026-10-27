import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { JobCostCloseCandidate } from '../../models/job-cost-close.model';

/**
 * Period-close worklist for job production cost: jobs whose GL WIP still carries a balance. Closing one
 * absorbs its actual labor + overhead into WIP and sweeps what is left to production variance; the job
 * then leaves the list. Full GL only.
 */
@Component({
  selector: 'app-job-cost-close',
  standalone: true,
  imports: [TranslatePipe, DataTableComponent, ColumnCellDirective, CurrencyDisplayComponent, EntityLinkComponent],
  templateUrl: './job-cost-close.component.html',
  styleUrl: './job-cost-close.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobCostCloseComponent implements OnInit {
  private readonly gl = inject(GeneralLedgerService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly closingId = signal<number | null>(null);
  protected readonly candidates = signal<JobCostCloseCandidate[]>([]);

  protected readonly columns: ColumnDef[] = [
    { field: 'jobNumber', header: this.translate.instant('accounting.jobCostClose.job'), sortable: true, width: '140px' },
    { field: 'title', header: this.translate.instant('accounting.jobCostClose.jobTitle'), sortable: true },
    { field: 'completedDate', header: this.translate.instant('accounting.jobCostClose.completed'), sortable: true, type: 'date', width: '120px' },
    { field: 'wipBalance', header: this.translate.instant('accounting.jobCostClose.wip'), sortable: true, type: 'number', align: 'right', width: '140px' },
    { field: 'receiptVariance', header: this.translate.instant('accounting.jobCostClose.receiptVariance'), sortable: true, type: 'number', align: 'right', width: '150px' },
    { field: 'actions', header: this.translate.instant('accounting.common.actions'), align: 'right', width: '150px' },
  ];

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.gl.getJobCostCloseCandidates().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        this.candidates.set(rows);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.snackbar.errorFrom(err, 'accounting.jobCostClose.loadFailed');
      },
    });
  }

  protected close(row: JobCostCloseCandidate): void {
    if (this.closingId() !== null || !row.isComplete) return;
    this.closingId.set(row.jobId);
    this.gl.closeJobProductionCost(row.jobId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.closingId.set(null);
        this.snackbar.success(this.translate.instant('accounting.jobCostClose.closed', {
          job: row.jobNumber,
          variance: result.productionVariance.toFixed(2),
        }));
        this.load();
      },
      error: () => this.closingId.set(null),
    });
  }
}
