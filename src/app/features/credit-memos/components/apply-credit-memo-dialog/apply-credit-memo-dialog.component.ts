import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, map, of } from 'rxjs';

import { CreditMemoService } from '../../services/credit-memo.service';
import { CreditMemoDetail } from '../../models/credit-memo-detail.model';
import { InvoiceService } from '../../../invoices/services/invoice.service';
import { InvoiceListItem } from '../../../invoices/models/invoice-list-item.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';

const round2 = (value: number): number => Math.round(value * 100) / 100;

@Component({
  selector: 'app-apply-credit-memo-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, CurrencyDisplayComponent, ValidationButtonComponent,
  ],
  templateUrl: './apply-credit-memo-dialog.component.html',
  styleUrl: './apply-credit-memo-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplyCreditMemoDialogComponent implements OnInit {
  private readonly service = inject(CreditMemoService);
  private readonly invoiceService = inject(InvoiceService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly memo = input.required<CreditMemoDetail>();
  readonly closed = output<void>();
  readonly applied = output<CreditMemoDetail>();

  protected readonly saving = signal(false);
  protected readonly invoices = signal<InvoiceListItem[]>([]);
  protected readonly loaded = signal(false);

  protected readonly invoiceOptions = computed<SelectOption[]>(() => this.invoices().map(inv => ({
    value: inv.id,
    label: this.translate.instant('creditMemos.invoiceOption', { number: inv.invoiceNumber, balance: inv.balanceDue.toFixed(2) }),
  })));

  protected readonly form = new FormGroup({
    invoiceId: new FormControl<number | null>(null, [Validators.required]),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    invoiceId: this.translate.instant('creditMemos.invoice'),
    amount: this.translate.instant('creditMemos.applyAmount'),
  });

  ngOnInit(): void {
    const memo = this.memo();
    this.invoiceService.getOpenInvoices(memo.customerId).pipe(
      map(list => list.filter(inv => inv.balanceDue > 0 && (inv.currencyId == null || inv.currencyId === memo.currencyId))),
      catchError(() => of<InvoiceListItem[]>([])),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(list => {
      this.invoices.set(list);
      this.loaded.set(true);
    });

    this.form.controls.invoiceId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(id => {
      const invoice = this.invoices().find(inv => inv.id === id);
      if (invoice) this.form.controls.amount.setValue(round2(Math.min(invoice.balanceDue, this.memo().openAmount)));
    });
  }

  protected canSave(): boolean {
    const invoice = this.invoices().find(inv => inv.id === this.form.controls.invoiceId.value);
    const amount = round2(this.form.controls.amount.value ?? 0);
    return this.form.valid && !!invoice && amount <= this.memo().openAmount && amount <= invoice.balanceDue;
  }

  protected save(): void {
    if (!this.canSave() || this.saving()) return;
    const f = this.form.getRawValue();
    this.saving.set(true);
    this.service.apply(this.memo().id, f.invoiceId!, round2(f.amount!)).subscribe({
      next: memo => {
        this.saving.set(false);
        this.applied.emit(memo);
      },
      error: () => this.saving.set(false),
    });
  }
}
