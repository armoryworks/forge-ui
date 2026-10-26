import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, of, startWith } from 'rxjs';

import { CreditMemoService } from '../../services/credit-memo.service';
import { CreditMemoLineRequest } from '../../models/credit-memo-line-request.model';
import { CREDIT_MEMO_REASON_TYPES } from '../../models/credit-memo-reason-types.const';
import { InvoiceService } from '../../../invoices/services/invoice.service';
import { InvoiceDetail } from '../../../invoices/models/invoice-detail.model';
import { InvoiceListItem } from '../../../invoices/models/invoice-list-item.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { DocumentCurrencyComponent } from '../../../../shared/components/document-currency/document-currency.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate, todayStart } from '../../../../shared/utils/date.utils';

interface MemoLineEntry {
  lineType: 'Item' | 'Freight' | 'RestockingFee';
  partId: number | null;
  partNumber: string | null;
  invoiceLineId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

@Component({
  selector: 'app-credit-memo-dialog',
  standalone: true,
  imports: [
    DecimalPipe, ReactiveFormsModule, MatTooltipModule, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, DatepickerComponent, TextareaComponent, EntityPickerComponent,
    DocumentCurrencyComponent, CurrencyDisplayComponent, ValidationButtonComponent,
  ],
  templateUrl: './credit-memo-dialog.component.html',
  styleUrl: './credit-memo-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreditMemoDialogComponent implements OnInit {
  private readonly service = inject(CreditMemoService);
  private readonly invoiceService = inject(InvoiceService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly invoiceId = input<number | null>(null);
  readonly closed = output<void>();
  readonly saved = output<number>();

  protected readonly saving = signal(false);
  protected readonly invoices = signal<InvoiceListItem[]>([]);
  protected readonly invoice = signal<InvoiceDetail | null>(null);
  protected readonly lines = signal<MemoLineEntry[]>([]);
  protected readonly customerFilters: Record<string, string> = { isActive: 'true' };

  protected readonly form = new FormGroup({
    customerId: new FormControl<number | null>(null, [Validators.required]),
    invoiceId: new FormControl<number | null>(null),
    reasonType: new FormControl<string>('Return', { nonNullable: true, validators: [Validators.required] }),
    reason: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
    creditDate: new FormControl<Date | null>(todayStart(), [Validators.required]),
    taxRate: new FormControl<number | null>(0, [Validators.min(0), Validators.max(99.9999)]),
    currencyId: new FormControl<number | null>(null),
    fxRate: new FormControl<number | null>(null),
    notes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  protected readonly lineForm = new FormGroup({
    lineType: new FormControl<'Item' | 'Freight' | 'RestockingFee'>('Item', { nonNullable: true }),
    invoiceLineId: new FormControl<number | null>(null),
    description: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    quantity: new FormControl<number | null>(1, [Validators.required, Validators.min(0.0001)]),
    unitPrice: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    customerId: this.translate.instant('common.customer'),
    reason: this.translate.instant('creditMemos.reasonLabel'),
    creditDate: this.translate.instant('creditMemos.creditDate'),
  });

  private readonly creditDateValue = toSignal(
    this.form.controls.creditDate.valueChanges.pipe(startWith(this.form.controls.creditDate.value)),
    { initialValue: this.form.controls.creditDate.value },
  );
  protected readonly documentDate = computed(() => this.creditDateValue() ?? null);

  protected readonly reasonOptions: SelectOption[] = CREDIT_MEMO_REASON_TYPES.map(r => ({
    value: r, label: this.translate.instant(`creditMemos.reason.${r}`),
  }));

  protected readonly lineTypeOptions: SelectOption[] = (['Item', 'Freight', 'RestockingFee'] as const).map(t => ({
    value: t, label: this.translate.instant(`creditMemos.lineType.${t}`),
  }));

  protected readonly invoiceOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('creditMemos.noInvoice') },
    ...this.invoices().map(inv => ({ value: inv.id, label: inv.invoiceNumber })),
  ]);

  protected readonly invoiceLineOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('creditMemos.freeLine') },
    ...(this.invoice()?.lines ?? []).filter(l => l.lineType !== 'Deposit').map(l => ({
      value: l.id,
      label: this.translate.instant('creditMemos.invoiceLineOption', { line: l.lineNumber, description: l.description, quantity: l.quantity }),
    })),
  ]);

  protected readonly currencyCode = computed(() => this.invoice()?.currencyCode ?? null);
  protected readonly lineAmounts = computed(() => this.lines().map(l =>
    (l.lineType === 'RestockingFee' ? -1 : 1) * round2(l.quantity * l.unitPrice)));
  protected readonly subtotal = computed(() => round2(this.lineAmounts().reduce((sum, a) => sum + a, 0)));

  ngOnInit(): void {
    this.form.controls.customerId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(id => this.loadInvoices(id));
    this.form.controls.invoiceId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(id => this.selectInvoice(id));
    this.lineForm.controls.invoiceLineId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(id => {
      const line = this.invoice()?.lines.find(l => l.id === id);
      if (!line) return;
      this.lineForm.patchValue({
        lineType: line.lineType === 'Freight' ? 'Freight' : 'Item',
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      });
    });

    const invoiceId = this.invoiceId();
    if (invoiceId) {
      this.invoiceService.getInvoiceById(invoiceId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(inv => {
        this.form.controls.customerId.setValue(inv.customerId);
        this.form.controls.invoiceId.setValue(inv.id);
      });
    }
  }

  private loadInvoices(customerId: number | null): void {
    this.invoices.set([]);
    if (!customerId) return;
    this.invoiceService.getInvoices(customerId).pipe(
      catchError(() => of<InvoiceListItem[]>([])),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(list => {
      const sent = list.filter(i => i.status !== 'Draft' && i.status !== 'Voided');
      const preset = this.invoice();
      this.invoices.set(preset && !sent.some(i => i.id === preset.id)
        ? [...sent, { id: preset.id, invoiceNumber: preset.invoiceNumber } as InvoiceListItem]
        : sent);
    });
  }

  private selectInvoice(id: number | null): void {
    this.lines.set([]);
    this.lineForm.reset({ lineType: 'Item', invoiceLineId: null, description: '', quantity: 1, unitPrice: null });
    if (!id) {
      this.invoice.set(null);
      this.form.controls.taxRate.setValue(0);
      return;
    }
    this.invoiceService.getInvoiceById(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(inv => {
      this.invoice.set(inv);
      this.form.controls.taxRate.setValue(Math.round(inv.taxRate * 1000000) / 10000);
      if (!this.invoices().some(i => i.id === inv.id))
        this.invoices.update(list => [...list, { id: inv.id, invoiceNumber: inv.invoiceNumber } as InvoiceListItem]);
    });
  }

  protected addLine(): void {
    if (this.lineForm.invalid) return;
    const f = this.lineForm.getRawValue();
    const source = this.invoice()?.lines.find(l => l.id === f.invoiceLineId);
    const description = f.description.trim() || source?.description || this.translate.instant(`creditMemos.lineType.${f.lineType}`);
    this.lines.update(prev => [...prev, {
      lineType: f.lineType,
      partId: source?.partId ?? null,
      partNumber: source?.partNumber ?? null,
      invoiceLineId: f.lineType === 'RestockingFee' ? null : f.invoiceLineId,
      description,
      quantity: f.quantity ?? 0,
      unitPrice: f.unitPrice ?? 0,
      taxable: source?.taxable ?? f.lineType !== 'Freight',
    }]);
    this.lineForm.reset({ lineType: 'Item', invoiceLineId: null, description: '', quantity: 1, unitPrice: null });
  }

  protected toggleTaxable(index: number): void {
    this.lines.update(prev => prev.map((l, i) => (i === index ? { ...l, taxable: !l.taxable } : l)));
  }

  protected removeLine(index: number): void {
    this.lines.update(prev => prev.filter((_, i) => i !== index));
  }

  protected canSave(): boolean {
    return this.form.valid && this.lines().length > 0 && this.subtotal() > 0 && !this.saving();
  }

  protected save(): void {
    if (!this.canSave()) return;
    const f = this.form.getRawValue();
    const lines: CreditMemoLineRequest[] = this.lines().map(l => ({
      lineType: l.lineType,
      partId: l.partId,
      invoiceLineId: l.invoiceLineId,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxable: l.taxable,
    }));
    this.saving.set(true);
    this.service.create({
      customerId: f.customerId!,
      invoiceId: f.invoiceId,
      reasonType: f.reasonType,
      reason: f.reason.trim(),
      creditDate: toIsoDate(f.creditDate),
      lines,
      taxRate: f.taxRate != null ? f.taxRate / 100 : null,
      currencyId: f.invoiceId ? null : f.currencyId,
      fxRate: f.invoiceId ? null : f.fxRate,
      notes: f.notes.trim() || null,
    }).subscribe({
      next: memo => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('creditMemos.created', { number: memo.creditMemoNumber }));
        this.saved.emit(memo.id);
      },
      error: () => this.saving.set(false),
    });
  }
}
