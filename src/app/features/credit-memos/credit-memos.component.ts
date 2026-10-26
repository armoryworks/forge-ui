import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CreditMemoService } from './services/credit-memo.service';
import { CreditMemoListItem } from './models/credit-memo-list-item.model';
import { CREDIT_MEMO_STATUSES } from './models/credit-memo-reason-types.const';
import { CreditMemoDialogComponent } from './components/credit-memo-dialog/credit-memo-dialog.component';
import { CreditMemoDetailDialogComponent } from './components/credit-memo-detail-dialog/credit-memo-detail-dialog.component';
import { CreditMemoDetailDialogData } from './models/credit-memo-detail-dialog-data.model';
import { creditMemoStatusChip } from './credit-memo-status';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { CurrencyDisplayComponent } from '../../shared/components/currency-display/currency-display.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { AuthService } from '../../shared/services/auth.service';
import { CapabilityService } from '../../shared/services/capability.service';

@Component({
  selector: 'app-credit-memos',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    PageHeaderComponent, InputComponent, SelectComponent, DataTableComponent, ColumnCellDirective,
    CurrencyDisplayComponent, LoadingBlockDirective, CreditMemoDialogComponent,
  ],
  templateUrl: './credit-memos.component.html',
  styleUrl: './credit-memos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreditMemosComponent {
  private readonly service = inject(CreditMemoService);
  private readonly translate = inject(TranslateService);
  private readonly detailDialog = inject(DetailDialogService);
  private readonly auth = inject(AuthService);
  private readonly capabilities = inject(CapabilityService);

  protected readonly loading = signal(false);
  protected readonly memos = signal<CreditMemoListItem[]>([]);
  protected readonly showCreateDialog = signal(false);

  protected readonly canCreate = computed(() =>
    this.capabilities.isEnabled('CAP-O2C-CREDITMEMO') && this.auth.hasAnyRole(['Admin', 'Manager', 'OfficeManager']));

  protected readonly searchControl = new FormControl('');
  protected readonly statusControl = new FormControl<string | null>(null);

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('creditMemos.allStatuses') },
    ...CREDIT_MEMO_STATUSES.map(s => ({ value: s, label: this.translate.instant(`creditMemos.status.${s}`) })),
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'creditMemoNumber', header: this.translate.instant('creditMemos.number'), sortable: true, width: '140px' },
    { field: 'customerName', header: this.translate.instant('common.customer'), sortable: true },
    { field: 'creditDate', header: this.translate.instant('creditMemos.creditDate'), sortable: true, type: 'date', width: '120px' },
    { field: 'reasonType', header: this.translate.instant('creditMemos.reasonType'), sortable: true, width: '150px' },
    { field: 'invoiceNumber', header: this.translate.instant('creditMemos.invoice'), sortable: true, width: '130px' },
    { field: 'total', header: this.translate.instant('common.total'), sortable: true, type: 'currency', align: 'right', width: '130px' },
    { field: 'openAmount', header: this.translate.instant('creditMemos.open'), sortable: true, type: 'currency', align: 'right', width: '130px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '150px' },
  ];

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.getCreditMemos({ status: this.statusControl.value, q: this.searchControl.value }).subscribe({
      next: list => {
        this.memos.set(list);
        this.loading.set(false);
        this.autoOpenFromUrl();
      },
      error: () => this.loading.set(false),
    });
  }

  private autoOpenFromUrl(): void {
    const detail = this.detailDialog.getDetailFromUrl();
    if (detail?.entityType === 'credit-memo') this.openDetail(detail.entityId);
  }

  protected openRow(row: unknown): void {
    this.openDetail((row as CreditMemoListItem).id);
  }

  private openDetail(id: number): void {
    this.detailDialog.open<CreditMemoDetailDialogComponent, CreditMemoDetailDialogData, boolean>(
      'credit-memo', id, CreditMemoDetailDialogComponent, { creditMemoId: id },
    ).afterClosed().subscribe(updated => {
      if (updated) this.load();
    });
  }

  protected openCreate(): void { this.showCreateDialog.set(true); }

  protected closeCreate(): void { this.showCreateDialog.set(false); }

  protected onCreated(id: number): void {
    this.closeCreate();
    this.load();
    this.openDetail(id);
  }

  protected statusClass(status: string): string {
    return creditMemoStatusChip(status);
  }
}
