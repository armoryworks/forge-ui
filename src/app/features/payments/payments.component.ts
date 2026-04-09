import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { PaymentService } from './services/payment.service';
import { PaymentListItem } from './models/payment-list-item.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AccountingService } from '../../shared/services/accounting.service';
import { PaymentDialogComponent } from './components/payment-dialog/payment-dialog.component';
import { PaymentDetailDialogComponent, PaymentDetailDialogData } from './components/payment-detail-dialog/payment-detail-dialog.component';
import { openDetailDialog } from '../../shared/utils/detail-dialog.utils';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, CurrencyPipe, TranslatePipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
    PaymentDialogComponent,
  ],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsComponent {
  // ⚡ ACCOUNTING BOUNDARY
  private readonly paymentService = inject(PaymentService);
  private readonly dialog = inject(MatDialog);
  private readonly accountingService = inject(AccountingService);
  private readonly translate = inject(TranslateService);

  protected readonly isStandalone = this.accountingService.isStandalone;
  protected readonly providerName = this.accountingService.providerName;

  protected readonly showCreateDialog = signal(false);
  protected readonly loading = signal(false);
  protected readonly payments = signal<PaymentListItem[]>([]);

  // Filters
  protected readonly searchControl = new FormControl('');
  protected readonly methodFilterControl = new FormControl<string | null>(null);

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });

  protected readonly methodOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('payments.allMethods') },
    { value: 'Cash', label: this.translate.instant('payments.methodCash') },
    { value: 'Check', label: this.translate.instant('payments.methodCheck') },
    { value: 'CreditCard', label: this.translate.instant('payments.methodCreditCard') },
    { value: 'BankTransfer', label: this.translate.instant('payments.methodBankTransfer') },
    { value: 'Wire', label: this.translate.instant('payments.methodWire') },
    { value: 'Other', label: this.translate.instant('payments.methodOther') },
  ];

  protected readonly paymentColumns: ColumnDef[] = [
    { field: 'paymentNumber', header: this.translate.instant('payments.paymentNumber'), sortable: true, width: '120px' },
    { field: 'customerName', header: this.translate.instant('payments.customer'), sortable: true },
    { field: 'method', header: this.translate.instant('payments.method'), sortable: true, filterable: true, type: 'enum', width: '100px', filterOptions: [
      { value: 'Cash', label: this.translate.instant('payments.methodCash') },
      { value: 'Check', label: this.translate.instant('payments.methodCheck') },
      { value: 'CreditCard', label: this.translate.instant('payments.methodCreditCard') },
      { value: 'BankTransfer', label: this.translate.instant('payments.methodBankTransfer') },
      { value: 'Wire', label: this.translate.instant('payments.methodWire') },
      { value: 'Other', label: this.translate.instant('payments.methodOther') },
    ]},
    { field: 'amount', header: this.translate.instant('payments.amount'), sortable: true, width: '100px', align: 'right' },
    { field: 'appliedAmount', header: this.translate.instant('payments.applied'), sortable: true, width: '100px', align: 'right' },
    { field: 'unappliedAmount', header: this.translate.instant('payments.unapplied'), sortable: true, width: '100px', align: 'right' },
    { field: 'paymentDate', header: this.translate.instant('common.date'), sortable: true, type: 'date', width: '110px' },
    { field: 'referenceNumber', header: this.translate.instant('payments.referenceNumber'), sortable: true, width: '120px' },
    { field: 'createdAt', header: this.translate.instant('common.created'), sortable: true, type: 'date', width: '110px' },
  ];

  protected readonly filteredPayments = computed(() => {
    const term = (this.searchTerm() ?? '').trim().toLowerCase();
    const method = this.methodFilterControl.value;
    let result = this.payments();
    if (term) {
      result = result.filter(p =>
        p.paymentNumber.toLowerCase().includes(term) ||
        p.customerName.toLowerCase().includes(term) ||
        (p.referenceNumber?.toLowerCase().includes(term) ?? false)
      );
    }
    if (method) {
      result = result.filter(p => p.method === method);
    }
    return result;
  });

  constructor() {
    this.loadPayments();
  }

  protected loadPayments(): void {
    this.loading.set(true);
    this.paymentService.getPayments().subscribe({
      next: (list) => { this.payments.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openPaymentDetail(item: PaymentListItem): void {
    openDetailDialog<PaymentDetailDialogComponent, PaymentDetailDialogData, boolean>(
      this.dialog,
      PaymentDetailDialogComponent,
      { paymentId: item.id },
    ).afterClosed().subscribe(changed => {
      if (changed) {
        this.loadPayments();
      }
    });
  }

  // --- Create Dialog ---
  protected openCreateDialog(): void { this.showCreateDialog.set(true); }
  protected closeCreateDialog(): void { this.showCreateDialog.set(false); }
  protected onCreateSaved(): void {
    this.closeCreateDialog();
    this.loadPayments();
  }

  protected getMethodLabel(method: string): string {
    const key = 'payments.method' + method;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : method;
  }
}
