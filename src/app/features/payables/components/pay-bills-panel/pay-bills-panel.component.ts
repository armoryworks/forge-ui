import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { merge } from 'rxjs';

import { VendorPaymentService } from '../../services/vendor-payment.service';
import { PaymentRunService } from '../../services/payment-run.service';
import { VendorPaymentSuggestion } from '../../models/vendor-payment-suggestion.model';
import { PaymentRunDetail } from '../../models/payment-run-detail.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate, todayStart } from '../../../../shared/utils/date.utils';
import { roundMoney } from '../../../../shared/utils/money.utils';

const DEFAULT_LOOKAHEAD_DAYS = 14;

/**
 * Payables > Pay bills: the payment run. Lists approved bills due by the cut-off date or with an early-payment
 * discount still open on the pay date, soonest discount deadline first, and pays the picked ones as a persisted
 * payment run: one vendor payment per vendor and currency, with each vendor's open credits deducted when asked. A run
 * interrupted part-way says so and offers to resume it.
 */
@Component({
  selector: 'app-pay-bills-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DateOnlyPipe,
    DataTableComponent, ColumnCellDirective, CurrencyDisplayComponent, DatepickerComponent, SelectComponent, ToggleComponent,
    LoadingBlockDirective,
  ],
  templateUrl: './pay-bills-panel.component.html',
  styleUrl: './pay-bills-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PayBillsPanelComponent {
  private readonly paymentService = inject(VendorPaymentService);
  private readonly runService = inject(PaymentRunService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly vendorOptions = input<SelectOption[]>([]);
  readonly paid = output<void>();

  protected readonly loading = signal(false);
  protected readonly paying = signal(false);
  protected readonly suggestions = signal<VendorPaymentSuggestion[]>([]);
  protected readonly selected = signal<VendorPaymentSuggestion[]>([]);
  protected readonly interruptedRun = signal<PaymentRunDetail | null>(null);

  protected readonly filters = new FormGroup({
    payDate: new FormControl<Date | null>(todayStart(), [Validators.required]),
    dueThrough: new FormControl<Date | null>(this.daysFromToday(DEFAULT_LOOKAHEAD_DAYS)),
    vendorId: new FormControl<number | null>(null),
    method: new FormControl<string | null>('Check', [Validators.required]),
    applyVendorCredits: new FormControl<boolean>(true, { nonNullable: true }),
  });

  protected readonly methodOptions: SelectOption[] = [
    { value: 'Check', label: this.translate.instant('payables.methodCheck') },
    { value: 'BankTransfer', label: this.translate.instant('payables.methodBankTransfer') },
    { value: 'Wire', label: this.translate.instant('payables.methodWire') },
    { value: 'Cash', label: this.translate.instant('payables.methodCash') },
    { value: 'CreditCard', label: this.translate.instant('payables.methodCreditCard') },
    { value: 'Other', label: this.translate.instant('payables.methodOther') },
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'billNumber', header: this.translate.instant('payables.billNumber'), sortable: true, width: '120px' },
    { field: 'vendorName', header: this.translate.instant('payables.vendor'), sortable: true },
    { field: 'dueDate', header: this.translate.instant('common.dueDate'), sortable: true, type: 'date', width: '110px' },
    { field: 'balanceDue', header: this.translate.instant('payables.balance'), sortable: true, width: '110px', align: 'right' },
    { field: 'suggestedDiscount', header: this.translate.instant('paymentTerms.discount'), sortable: true, width: '110px', align: 'right' },
    { field: 'discountDeadline', header: this.translate.instant('paymentTerms.discountDeadline'), sortable: true, type: 'date', width: '150px' },
    { field: 'suggestedPayAmount', header: this.translate.instant('paymentTerms.payAmount'), sortable: true, width: '110px', align: 'right' },
    { field: 'vendorOpenCredit', header: this.translate.instant('paymentRuns.vendorCredit'), sortable: true, width: '120px', align: 'right' },
  ];

  protected readonly cashTotal = computed(() => roundMoney(this.selected().reduce((sum, s) => sum + s.suggestedPayAmount, 0)));
  protected readonly savingsTotal = computed(() => roundMoney(this.selected().reduce((sum, s) => sum + s.suggestedDiscount, 0)));
  protected readonly creditTotal = computed(() => {
    const byVendor = new Map<string, { credit: number; cash: number }>();
    for (const s of this.selected()) {
      const key = `${s.vendorId}:${s.currencyId}`;
      const entry = byVendor.get(key) ?? { credit: s.vendorOpenCredit ?? 0, cash: 0 };
      entry.cash += s.suggestedPayAmount;
      byVendor.set(key, entry);
    }
    return roundMoney([...byVendor.values()].reduce((sum, v) => sum + Math.min(v.credit, v.cash), 0));
  });
  protected readonly totalsCurrency = computed(() => {
    const codes = new Set(this.selected().map(s => s.currencyCode ?? null));
    return codes.size === 1 ? [...codes][0] : null;
  });

  constructor() {
    const { payDate, dueThrough, vendorId } = this.filters.controls;
    merge(payDate.valueChanges, dueThrough.valueChanges, vendorId.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.load());
    this.load();
  }

  private daysFromToday(days: number): Date {
    const d = todayStart();
    d.setDate(d.getDate() + days);
    return d;
  }

  protected load(): void {
    const { payDate, dueThrough, vendorId } = this.filters.getRawValue();
    const pay = toIsoDate(payDate);
    if (!pay) return;
    this.loading.set(true);
    this.selected.set([]);
    this.paymentService.getPaymentSuggestions(pay, toIsoDate(dueThrough) ?? undefined, vendorId ?? undefined).subscribe({
      next: list => {
        this.suggestions.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected onSelectionChange(rows: unknown[]): void {
    this.selected.set(rows as VendorPaymentSuggestion[]);
  }

  protected pay(): void {
    const rows = this.selected();
    const { payDate, method, applyVendorCredits } = this.filters.getRawValue();
    if (rows.length === 0 || !method || !payDate || this.paying()) return;
    this.paying.set(true);
    this.interruptedRun.set(null);
    this.runService.create({
      paymentDate: toIsoDate(payDate)!,
      method,
      applyVendorCredits,
      items: rows.map(r => ({ vendorBillId: r.vendorBillId, amount: r.suggestedPayAmount, discountAmount: r.suggestedDiscount })),
    }).subscribe({
      next: run => this.finished(run),
      error: () => this.paying.set(false),
    });
  }

  protected resume(): void {
    const run = this.interruptedRun();
    if (!run || this.paying()) return;
    this.paying.set(true);
    this.runService.resume(run.id).subscribe({
      next: resumed => this.finished(resumed),
      error: () => this.paying.set(false),
    });
  }

  private finished(run: PaymentRunDetail): void {
    this.paying.set(false);
    const payments = new Set(run.items.map(i => i.vendorPaymentId).filter(id => id !== null)).size;
    if (run.status === 'Interrupted') {
      this.interruptedRun.set(run);
      this.snackbar.error(this.translate.instant('paymentRuns.interrupted', { number: run.runNumber, error: run.lastError ?? '' }));
    } else {
      this.interruptedRun.set(null);
      this.snackbar.success(this.translate.instant('paymentRuns.completed', { number: run.runNumber, count: payments }));
    }
    this.load();
    this.paid.emit();
  }
}
