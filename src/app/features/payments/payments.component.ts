import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { PaymentService } from './services/payment.service';
import { PaymentListItem } from './models/payment-list-item.model';
import { PaymentDetail } from './models/payment-detail.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, CurrencyPipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
  ],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsComponent {
  // ⚡ ACCOUNTING BOUNDARY
  private readonly paymentService = inject(PaymentService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);

  protected readonly loading = signal(false);
  protected readonly payments = signal<PaymentListItem[]>([]);
  protected readonly selectedPayment = signal<PaymentDetail | null>(null);

  // Filters
  protected readonly searchControl = new FormControl('');
  protected readonly methodFilterControl = new FormControl<string | null>(null);

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });

  protected readonly methodOptions: SelectOption[] = [
    { value: null, label: 'All Methods' },
    { value: 'Cash', label: 'Cash' },
    { value: 'Check', label: 'Check' },
    { value: 'CreditCard', label: 'Credit Card' },
    { value: 'BankTransfer', label: 'Bank Transfer' },
    { value: 'Wire', label: 'Wire' },
    { value: 'Other', label: 'Other' },
  ];

  protected readonly paymentColumns: ColumnDef[] = [
    { field: 'paymentNumber', header: 'Payment #', sortable: true, width: '120px' },
    { field: 'customerName', header: 'Customer', sortable: true },
    { field: 'method', header: 'Method', sortable: true, filterable: true, type: 'enum', width: '100px', filterOptions: [
      { value: 'Cash', label: 'Cash' },
      { value: 'Check', label: 'Check' },
      { value: 'CreditCard', label: 'Credit Card' },
      { value: 'BankTransfer', label: 'Bank Transfer' },
      { value: 'Wire', label: 'Wire' },
      { value: 'Other', label: 'Other' },
    ]},
    { field: 'amount', header: 'Amount', sortable: true, width: '100px', align: 'right' },
    { field: 'appliedAmount', header: 'Applied', sortable: true, width: '100px', align: 'right' },
    { field: 'unappliedAmount', header: 'Unapplied', sortable: true, width: '100px', align: 'right' },
    { field: 'paymentDate', header: 'Date', sortable: true, type: 'date', width: '110px' },
    { field: 'referenceNumber', header: 'Reference #', sortable: true, width: '120px' },
    { field: 'createdAt', header: 'Created', sortable: true, type: 'date', width: '110px' },
  ];

  protected readonly paymentRowClass = (row: unknown) => {
    const payment = row as PaymentListItem;
    return payment.id === this.selectedPayment()?.id ? 'row--selected' : '';
  };

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

  protected selectPayment(item: PaymentListItem): void {
    this.paymentService.getPaymentById(item.id).subscribe({
      next: (detail) => this.selectedPayment.set(detail),
    });
  }

  protected closeDetail(): void { this.selectedPayment.set(null); }

  protected getMethodLabel(method: string): string {
    const map: Record<string, string> = {
      CreditCard: 'Credit Card',
      BankTransfer: 'Bank Transfer',
    };
    return map[method] ?? method;
  }

  protected deletePayment(): void {
    const payment = this.selectedPayment();
    if (!payment) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Payment?',
        message: `Delete payment "${payment.paymentNumber}"? This action cannot be undone.`,
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.paymentService.deletePayment(payment.id).subscribe({
        next: () => {
          this.selectedPayment.set(null);
          this.loadPayments();
          this.snackbar.success('Payment deleted.');
        },
      });
    });
  }

  protected canDelete(): boolean {
    const payment = this.selectedPayment();
    return !!payment && payment.applications.length === 0;
  }
}
