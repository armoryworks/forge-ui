import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { merge } from 'rxjs';

import { VendorCreditMemoService } from '../../services/vendor-credit-memo.service';
import { VendorCreditMemoListItem } from '../../models/vendor-credit-memo-list-item.model';
import { VendorCreditMemoDetailDialogData } from '../../models/vendor-credit-memo-detail-dialog-data.model';
import { vendorCreditStatusChip } from '../../vendor-credit-status';
import { PAYABLES_MANAGE_ROLES } from '../../payables-roles';
import { VendorCreditMemoDialogComponent } from '../vendor-credit-memo-dialog/vendor-credit-memo-dialog.component';
import { VendorCreditMemoDetailDialogComponent } from '../vendor-credit-memo-detail-dialog/vendor-credit-memo-detail-dialog.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DetailDialogService } from '../../../../shared/services/detail-dialog.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';

const STATUSES = ['Draft', 'Open', 'PartiallyApplied', 'Applied', 'Voided'];

/** Payables > Vendor credits: vendor credit and debit memos, with the editor and the detail dialog. */
@Component({
  selector: 'app-vendor-credits-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DateOnlyPipe,
    DataTableComponent, ColumnCellDirective, CurrencyDisplayComponent, SelectComponent, LoadingBlockDirective,
    VendorCreditMemoDialogComponent,
  ],
  templateUrl: './vendor-credits-panel.component.html',
  styleUrl: './vendor-credits-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorCreditsPanelComponent {
  private readonly service = inject(VendorCreditMemoService);
  private readonly detailDialog = inject(DetailDialogService);
  private readonly translate = inject(TranslateService);

  readonly vendorOptions = input<SelectOption[]>([]);

  protected readonly canManage = inject(AuthService).hasAnyRole(PAYABLES_MANAGE_ROLES);
  protected readonly loading = signal(false);
  protected readonly memos = signal<VendorCreditMemoListItem[]>([]);
  protected readonly showCreate = signal(false);

  protected readonly filters = new FormGroup({
    vendorId: new FormControl<number | null>(null),
    status: new FormControl<string | null>(null),
  });

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('payables.allStatuses') },
    ...STATUSES.map(s => ({ value: s, label: this.translate.instant(`vendorCredits.status.${s}`) })),
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'memoNumber', header: this.translate.instant('vendorCredits.number'), sortable: true, width: '120px' },
    { field: 'vendorName', header: this.translate.instant('payables.vendor'), sortable: true },
    { field: 'kind', header: this.translate.instant('vendorCredits.kindLabel'), sortable: true, width: '140px' },
    { field: 'vendorBillNumber', header: this.translate.instant('vendorCredits.bill'), sortable: true, width: '120px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '140px' },
    { field: 'memoDate', header: this.translate.instant('common.date'), sortable: true, type: 'date', width: '110px' },
    { field: 'total', header: this.translate.instant('common.total'), sortable: true, width: '110px', align: 'right' },
    { field: 'openAmount', header: this.translate.instant('vendorCredits.open'), sortable: true, width: '110px', align: 'right' },
  ];

  constructor() {
    merge(this.filters.controls.vendorId.valueChanges, this.filters.controls.status.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.load());
    this.load();
    const detail = this.detailDialog.getDetailFromUrl();
    if (detail?.entityType === 'vendor-credit-memo') this.openDetail(detail.entityId);
  }

  protected load(): void {
    const { vendorId, status } = this.filters.getRawValue();
    this.loading.set(true);
    this.service.getMemos({ vendorId, status }).subscribe({
      next: list => {
        this.memos.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected statusClass(status: string): string {
    return vendorCreditStatusChip(status);
  }

  protected openDetail(id: number): void {
    this.detailDialog.open<VendorCreditMemoDetailDialogComponent, VendorCreditMemoDetailDialogData, boolean>(
      'vendor-credit-memo', id, VendorCreditMemoDetailDialogComponent, { memoId: id }, { width: '800px' },
    ).afterClosed().subscribe(changed => {
      if (changed) this.load();
    });
  }

  protected onCreated(id: number): void {
    this.showCreate.set(false);
    this.load();
    this.openDetail(id);
  }
}
