import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, map, of } from 'rxjs';

import { PaymentService } from '../../services/payment.service';
import { PaymentDetail } from '../../models/payment-detail.model';
import { InvoiceService } from '../../../invoices/services/invoice.service';
import { InvoiceListItem } from '../../../invoices/models/invoice-list-item.model';
import { AutocompleteComponent, AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ActiveCurrencyService } from '../../../../shared/services/active-currency.service';

interface CreditApplication {
  invoiceId: number;
  invoiceNumber: string;
  amount: number;
  settlementFxRate: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

@Component({
  selector: 'app-apply-credit-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatTooltipModule, TranslatePipe,
    DialogComponent, InputComponent, AutocompleteComponent, CurrencyDisplayComponent,
  ],
  templateUrl: './apply-credit-dialog.component.html',
  styleUrl: './apply-credit-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplyCreditDialogComponent implements OnInit {
  private readonly paymentService = inject(PaymentService);
  private readonly invoiceService = inject(InvoiceService);
  private readonly currencyService = inject(ActiveCurrencyService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly payment = input.required<PaymentDetail>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly openInvoices = signal<InvoiceListItem[]>([]);
  protected readonly applications = signal<CreditApplication[]>([]);
  protected readonly activeCurrencyCount = signal(0);
  protected readonly showSettlementFxRate = computed(() => this.activeCurrencyCount() > 1);

  protected readonly totalApplied = computed(() =>
    round2(this.applications().reduce((sum, a) => sum + a.amount, 0)));
  protected readonly remainingCredit = computed(() =>
    round2(this.payment().unappliedAmount - this.totalApplied()));

  protected readonly invoiceOptions = computed<AutocompleteOption[]>(() => {
    const used = new Set(this.applications().map(a => a.invoiceId));
    return this.openInvoices()
      .filter(inv => !used.has(inv.id))
      .map(inv => ({ value: inv.id, label: `${inv.invoiceNumber} — ${inv.balanceDue.toFixed(2)}` }));
  });

  protected readonly appForm = new FormGroup({
    invoiceId: new FormControl<number | null>(null, [Validators.required]),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    settlementFxRate: new FormControl<number>(1, [Validators.required, Validators.min(0.0000001)]),
  });

  ngOnInit(): void {
    this.invoiceService.getInvoices(this.payment().customerId).pipe(
      map(list => list.filter(inv => inv.balanceDue > 0 && inv.status !== 'Draft' && inv.status !== 'Voided')),
      catchError(() => of<InvoiceListItem[]>([])),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(list => this.openInvoices.set(list));

    this.appForm.controls.invoiceId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(invoiceId => {
      const invoice = this.openInvoices().find(inv => inv.id === invoiceId);
      if (invoice && this.appForm.controls.amount.value == null) {
        const suggested = round2(Math.min(invoice.balanceDue, this.remainingCredit()));
        if (suggested > 0) this.appForm.controls.amount.setValue(suggested);
      }
    });

    this.currencyService.listActiveCurrencies().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => this.activeCurrencyCount.set(list.length),
    });
  }

  protected canAdd(): boolean {
    const amount = this.appForm.controls.amount.value ?? 0;
    return this.appForm.valid && round2(amount) <= this.remainingCredit();
  }

  protected addApplication(): void {
    if (!this.canAdd()) return;
    const f = this.appForm.getRawValue();
    const invoice = this.openInvoices().find(inv => inv.id === f.invoiceId);
    if (!invoice) return;
    this.applications.update(prev => [...prev, {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: round2(f.amount!),
      settlementFxRate: f.settlementFxRate ?? 1,
    }]);
    this.appForm.reset({ invoiceId: null, amount: null, settlementFxRate: 1 });
  }

  protected removeApplication(index: number): void {
    this.applications.update(prev => prev.filter((_, i) => i !== index));
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    const apps = this.applications();
    if (apps.length === 0 || this.remainingCredit() < 0) return;
    this.saving.set(true);
    this.paymentService.applyPayment(this.payment().id, {
      applications: apps.map(a => ({
        invoiceId: a.invoiceId,
        amount: a.amount,
        settlementFxRate: this.showSettlementFxRate() ? a.settlementFxRate : undefined,
      })),
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('payments.creditApplied'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
