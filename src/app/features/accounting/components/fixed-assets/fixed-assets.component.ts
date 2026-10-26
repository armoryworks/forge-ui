import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';

import { debounceTime, map } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DEPRECIATION_METHODS, FixedAsset, FixedAssetStatus } from '../../models/fixed-asset.model';
import { FixedAssetService } from '../../services/fixed-asset.service';
import { bookIdFromParams } from '../../utils/statement-period';
import { DepreciationRunDialogComponent, DepreciationRunDialogData } from '../depreciation-run-dialog/depreciation-run-dialog.component';
import { FixedAssetDialogComponent, FixedAssetDialogData } from '../fixed-asset-dialog/fixed-asset-dialog.component';

const STATUSES: readonly FixedAssetStatus[] = ['Active', 'FullyDepreciated', 'Disposed'];

/**
 * Fixed-asset register: every depreciable asset in the book with cost, accumulated depreciation and net book
 * value, filtered by status, method and text (all in the URL). Registers new assets and runs a month's
 * depreciation (preview first, then post). Controller, CAP-ACCT-FULLGL + CAP-ACCT-DEPRECIATION.
 */
@Component({
  selector: 'app-fixed-assets',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DateOnlyPipe, PageLayoutComponent, DataTableComponent, ColumnCellDirective,
    CurrencyDisplayComponent, InputComponent, SelectComponent, LoadingBlockDirective,
  ],
  templateUrl: './fixed-assets.component.html',
  styleUrl: './fixed-assets.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FixedAssetsComponent implements OnInit {
  private readonly service = inject(FixedAssetService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly assets = signal<FixedAsset[]>([]);
  protected readonly bookId = signal(1);

  private readonly query = toSignal(
    this.route.queryParamMap.pipe(map((p) => ({ status: p.get('status'), method: p.get('method'), q: p.get('q') ?? '' }))),
    { initialValue: { status: null as string | null, method: null as string | null, q: '' } },
  );

  protected readonly statusControl = new FormControl<string | null>(null);
  protected readonly methodControl = new FormControl<string | null>(null);
  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('accounting.fixedAssets.allStatuses') },
    ...STATUSES.map((s) => ({ value: s, label: this.translate.instant(`accounting.fixedAssets.status.${s}`) })),
  ];

  protected readonly methodOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('accounting.fixedAssets.allMethods') },
    ...DEPRECIATION_METHODS.map((m) => ({ value: m, label: this.translate.instant(`accounting.fixedAssets.method.${m}`) })),
  ];

  protected readonly rows = computed(() => {
    const { status, method, q } = this.query();
    const term = q.trim().toLowerCase();
    return this.assets()
      .filter((a) => !status || a.status === status)
      .filter((a) => !method || a.method === method)
      .filter((a) => !term || a.name.toLowerCase().includes(term) || (a.assetTag ?? '').toLowerCase().includes(term))
      .map((a) => ({
        ...a,
        methodLabel: this.translate.instant(`accounting.fixedAssets.method.${a.method}`),
        statusLabel: this.translate.instant(`accounting.fixedAssets.status.${a.status}`),
      }));
  });

  protected readonly totals = computed(() => {
    const rows = this.rows();
    return {
      cost: rows.reduce((sum, r) => sum + r.cost, 0),
      accumulated: rows.reduce((sum, r) => sum + r.accumulatedDepreciation, 0),
      netBookValue: rows.reduce((sum, r) => sum + r.netBookValue, 0),
    };
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'assetTag', header: this.translate.instant('accounting.fixedAssets.assetTag'), sortable: true, width: '110px' },
    { field: 'name', header: this.translate.instant('accounting.fixedAssets.name'), sortable: true },
    { field: 'methodLabel', header: this.translate.instant('accounting.fixedAssets.methodLabel'), sortable: true, width: '160px', phoneHidden: true },
    { field: 'inServiceDate', header: this.translate.instant('accounting.fixedAssets.inServiceDate'), sortable: true, width: '120px' },
    { field: 'cost', header: this.translate.instant('accounting.fixedAssets.cost'), sortable: true, type: 'number', align: 'right', width: '130px' },
    { field: 'accumulatedDepreciation', header: this.translate.instant('accounting.fixedAssets.accumulated'), sortable: true, type: 'number', align: 'right', width: '140px', phoneHidden: true },
    { field: 'netBookValue', header: this.translate.instant('accounting.fixedAssets.netBookValue'), sortable: true, type: 'number', align: 'right', width: '140px' },
    { field: 'statusLabel', header: this.translate.instant('accounting.common.status'), sortable: true, width: '150px' },
  ];

  ngOnInit(): void {
    this.bookId.set(bookIdFromParams(this.route.snapshot.queryParamMap));
    const q = this.query();
    this.statusControl.setValue(q.status, { emitEvent: false });
    this.methodControl.setValue(q.method, { emitEvent: false });
    this.searchControl.setValue(q.q, { emitEvent: false });

    this.statusControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status) => this.setQuery({ status }));
    this.methodControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((method) => this.setQuery({ method }));
    this.searchControl.valueChanges
      .pipe(debounceTime(250), takeUntilDestroyed(this.destroyRef))
      .subscribe((text) => this.setQuery({ q: text.trim() || null }));

    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.list(this.bookId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (assets) => {
        this.assets.set(assets);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.snackbar.errorFrom(err, 'accounting.fixedAssets.loadFailed');
      },
    });
  }

  protected open(row: unknown): void {
    this.router.navigate(['/accounting/fixed-assets', (row as FixedAsset).id]);
  }

  protected register(): void {
    this.dialog
      .open(FixedAssetDialogComponent, { width: '800px', data: { bookId: this.bookId() } satisfies FixedAssetDialogData })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        if (saved) this.load();
      });
  }

  protected runDepreciation(): void {
    this.dialog
      .open(DepreciationRunDialogComponent, { width: '800px', data: { bookId: this.bookId() } satisfies DepreciationRunDialogData })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((posted) => {
        if (posted) this.load();
      });
  }

  private setQuery(params: Record<string, string | null>): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
