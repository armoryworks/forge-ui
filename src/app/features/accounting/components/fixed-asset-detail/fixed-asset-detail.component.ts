import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { FixedAssetDetail } from '../../models/fixed-asset-detail.model';
import { FixedAssetService } from '../../services/fixed-asset.service';
import { DisposeFixedAssetDialogComponent, DisposeFixedAssetDialogData } from '../dispose-fixed-asset-dialog/dispose-fixed-asset-dialog.component';
import { FixedAssetDialogComponent, FixedAssetDialogData } from '../fixed-asset-dialog/fixed-asset-dialog.component';

/**
 * One fixed asset: cost, accumulated depreciation and book value, then the schedule (posted months link to the
 * ledger of the accumulated-depreciation account; projected months follow to the end of life). Edit is offered
 * until the first depreciation posts; Dispose until the asset is disposed. Controller,
 * CAP-ACCT-FULLGL + CAP-ACCT-DEPRECIATION.
 */
@Component({
  selector: 'app-fixed-asset-detail',
  standalone: true,
  imports: [
    RouterLink, TranslatePipe, DateOnlyPipe, PageLayoutComponent, DataTableComponent, ColumnCellDirective,
    CurrencyDisplayComponent, LoadingBlockDirective,
  ],
  templateUrl: './fixed-asset-detail.component.html',
  styleUrl: './fixed-asset-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FixedAssetDetailComponent implements OnInit {
  private readonly service = inject(FixedAssetService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly notFound = signal(false);
  protected readonly detail = signal<FixedAssetDetail | null>(null);

  protected readonly canDispose = computed(() => {
    const d = this.detail();
    return !!d && d.asset.status !== 'Disposed';
  });

  protected readonly scheduleRows = computed(() =>
    (this.detail()?.schedule ?? []).map((row) => ({
      ...row,
      id: row.periodMonth,
      stateLabel: this.translate.instant(row.posted ? 'accounting.fixedAssets.posted' : 'accounting.fixedAssets.projected'),
    })),
  );

  protected readonly columns: ColumnDef[] = [
    { field: 'periodMonth', header: this.translate.instant('accounting.fixedAssets.periodMonth'), width: '130px' },
    { field: 'amount', header: this.translate.instant('accounting.fixedAssets.charge'), type: 'number', align: 'right', width: '140px' },
    { field: 'accumulatedDepreciation', header: this.translate.instant('accounting.fixedAssets.accumulated'), type: 'number', align: 'right', width: '150px' },
    { field: 'netBookValue', header: this.translate.instant('accounting.fixedAssets.netBookValue'), type: 'number', align: 'right', width: '150px' },
    { field: 'stateLabel', header: this.translate.instant('accounting.common.status'), width: '130px' },
  ];

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = Number(params.get('id'));
      if (!Number.isInteger(id) || id <= 0) {
        this.notFound.set(true);
        return;
      }
      this.load(id);
    });
  }

  protected edit(): void {
    const detail = this.detail();
    if (!detail?.isEditable) return;
    this.dialog
      .open(FixedAssetDialogComponent, { width: '800px', data: { bookId: detail.asset.bookId, detail } satisfies FixedAssetDialogData })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        if (saved) this.load(detail.asset.id);
      });
  }

  protected dispose(): void {
    const detail = this.detail();
    if (!detail || !this.canDispose()) return;
    this.dialog
      .open(DisposeFixedAssetDialogComponent, { width: '520px', data: { detail } satisfies DisposeFixedAssetDialogData })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((disposed) => {
        if (disposed) this.load(detail.asset.id);
      });
  }

  protected back(): void {
    this.router.navigate(['/accounting/fixed-assets']);
  }

  private load(id: number): void {
    this.loading.set(true);
    this.service.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.notFound.set(false);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.notFound.set(true);
        this.snackbar.errorFrom(err, 'accounting.fixedAssets.loadFailed');
      },
    });
  }
}
