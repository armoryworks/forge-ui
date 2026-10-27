import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { startWith } from 'rxjs';

import { VendorCreditMemoService } from '../../services/vendor-credit-memo.service';
import { VendorBillService } from '../../services/vendor-bill.service';
import { VendorBillDetail } from '../../models/vendor-bill-detail.model';
import { VendorCreditMemoDetail } from '../../models/vendor-credit-memo-detail.model';
import { VendorCreditMemoLineEntry } from '../../models/vendor-credit-memo-line-entry.model';
import { VendorCreditMemoLineRequest } from '../../models/vendor-credit-memo-line-request.model';
import { VendorService } from '../../../vendors/services/vendor.service';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DocumentCurrencyComponent } from '../../../../shared/components/document-currency/document-currency.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { fromIsoDate, toIsoDate, todayStart } from '../../../../shared/utils/date.utils';
import { roundMoney } from '../../../../shared/utils/money.utils';

/**
 * Create or edit a draft vendor credit or debit memo. From a bill, the memo takes the bill's vendor and currency and
 * its lines credit the bill's lines, each capped at the billed quantity and price; standalone, lines credit an
 * expense account by determination key.
 */
@Component({
  selector: 'app-vendor-credit-memo-dialog',
  standalone: true,
  imports: [
    DecimalPipe, ReactiveFormsModule, MatTooltipModule, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, DatepickerComponent, TextareaComponent,
    DocumentCurrencyComponent, CurrencyDisplayComponent, ValidationButtonComponent,
  ],
  templateUrl: './vendor-credit-memo-dialog.component.html',
  styleUrl: './vendor-credit-memo-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorCreditMemoDialogComponent implements OnInit {
  private readonly service = inject(VendorCreditMemoService);
  private readonly billService = inject(VendorBillService);
  private readonly vendorService = inject(VendorService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly billId = input<number | null>(null);
  readonly memo = input<VendorCreditMemoDetail | null>(null);
  readonly closed = output<void>();
  readonly saved = output<number>();

  protected readonly saving = signal(false);
  protected readonly bill = signal<VendorBillDetail | null>(null);
  protected readonly lines = signal<VendorCreditMemoLineEntry[]>([]);
  protected readonly vendorOptions = signal<SelectOption[]>([]);
  protected readonly isEdit = computed(() => this.memo() !== null);

  protected readonly form = new FormGroup({
    vendorId: new FormControl<number | null>(null, [Validators.required]),
    kind: new FormControl<string>('VendorCredit', { nonNullable: true }),
    sourceType: new FormControl<string>('Return', { nonNullable: true, validators: [Validators.required] }),
    reason: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
    vendorReference: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    memoDate: new FormControl<Date | null>(todayStart(), [Validators.required]),
    taxAmount: new FormControl<number | null>(0, [Validators.min(0)]),
    currencyId: new FormControl<number | null>(null),
    fxRate: new FormControl<number | null>(null),
    notes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  protected readonly lineForm = new FormGroup({
    vendorBillLineId: new FormControl<number | null>(null),
    description: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    quantity: new FormControl<number | null>(1, [Validators.required, Validators.min(0.0001)]),
    unitPrice: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    vendorId: this.translate.instant('payables.vendor'),
    reason: this.translate.instant('vendorCredits.reasonLabel'),
    memoDate: this.translate.instant('vendorCredits.memoDate'),
  });

  private readonly memoDateValue = toSignal(
    this.form.controls.memoDate.valueChanges.pipe(startWith(this.form.controls.memoDate.value)),
    { initialValue: this.form.controls.memoDate.value },
  );
  protected readonly documentDate = computed(() => this.memoDateValue() ?? null);

  protected readonly kindOptions: SelectOption[] = ['VendorCredit', 'DebitMemo'].map(k => ({
    value: k, label: this.translate.instant(`vendorCredits.kind.${k}`),
  }));
  protected readonly sourceOptions: SelectOption[] = ['Return', 'PriceAdjustment', 'Rebate', 'Other'].map(s => ({
    value: s, label: this.translate.instant(`vendorCredits.source.${s}`),
  }));

  protected readonly billLineOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('vendorCredits.freeLine') },
    ...(this.bill()?.lines ?? []).map(l => ({
      value: l.id,
      label: this.translate.instant('vendorCredits.billLineOption', { line: l.lineNumber, description: l.description, quantity: l.quantity }),
    })),
  ]);

  protected readonly currencyCode = computed(() => this.bill()?.currencyCode ?? null);
  protected readonly lineAmounts = computed(() => this.lines().map(l => roundMoney(l.quantity * l.unitPrice)));
  protected readonly subtotal = computed(() => roundMoney(this.lineAmounts().reduce((sum, a) => sum + a, 0)));
  protected readonly overCap = computed(() => this.lines().some(l =>
    (l.maxQuantity !== null && l.quantity > l.maxQuantity) || (l.maxUnitPrice !== null && l.unitPrice > l.maxUnitPrice)));

  ngOnInit(): void {
    this.vendorService.getVendorDropdown().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(vendors =>
      this.vendorOptions.set(vendors.map(v => ({ value: v.id, label: v.companyName }))));

    this.lineForm.controls.vendorBillLineId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(id => {
      const line = this.bill()?.lines.find(l => l.id === id);
      if (!line) return;
      this.lineForm.patchValue({ description: line.description, quantity: line.quantity, unitPrice: line.unitPrice });
    });

    const memo = this.memo();
    if (memo) {
      this.form.patchValue({
        vendorId: memo.vendorId, kind: memo.kind, sourceType: memo.sourceType, reason: memo.reason,
        vendorReference: memo.vendorReference ?? '', memoDate: fromIsoDate(memo.memoDate), taxAmount: memo.taxAmount,
        notes: memo.notes ?? '',
      });
      this.form.controls.vendorId.disable();
      this.lines.set(memo.lines.map(l => ({
        vendorBillLineId: l.vendorBillLineId, partId: l.partId, description: l.description,
        quantity: l.quantity, unitPrice: l.unitPrice, maxQuantity: null, maxUnitPrice: null,
      })));
      if (memo.vendorBillId) this.loadBill(memo.vendorBillId);
      return;
    }

    const billId = this.billId();
    if (billId) this.loadBill(billId, true);
  }

  private loadBill(id: number, fillFromBill = false): void {
    this.billService.getVendorBillById(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(bill => {
      this.bill.set(bill);
      if (!fillFromBill) {
        this.lines.update(lines => lines.map(l => this.withCaps(l, bill)));
        return;
      }
      this.form.controls.vendorId.setValue(bill.vendorId);
      this.form.controls.vendorId.disable();
      this.form.controls.reason.setValue(this.translate.instant('vendorCredits.defaultReason', { bill: bill.billNumber }));
    });
  }

  private withCaps(line: VendorCreditMemoLineEntry, bill: VendorBillDetail): VendorCreditMemoLineEntry {
    const source = bill.lines.find(b => b.id === line.vendorBillLineId);
    return source ? { ...line, maxQuantity: source.quantity, maxUnitPrice: source.unitPrice } : line;
  }

  protected addLine(): void {
    if (this.lineForm.invalid) return;
    const f = this.lineForm.getRawValue();
    const bill = this.bill();
    const source = bill?.lines.find(l => l.id === f.vendorBillLineId);
    const entry: VendorCreditMemoLineEntry = {
      vendorBillLineId: source?.id ?? null,
      partId: source?.partId ?? null,
      description: f.description.trim() || source?.description || this.translate.instant('vendorCredits.creditLine'),
      quantity: f.quantity ?? 0,
      unitPrice: f.unitPrice ?? 0,
      maxQuantity: null,
      maxUnitPrice: null,
    };
    this.lines.update(prev => [...prev, bill ? this.withCaps(entry, bill) : entry]);
    this.lineForm.reset({ vendorBillLineId: null, description: '', quantity: 1, unitPrice: null });
  }

  protected removeLine(index: number): void {
    this.lines.update(prev => prev.filter((_, i) => i !== index));
  }

  protected canSave(): boolean {
    return this.form.valid && this.lines().length > 0 && this.subtotal() > 0 && !this.overCap() && !this.saving();
  }

  protected save(): void {
    if (!this.canSave()) return;
    const f = this.form.getRawValue();
    const lines: VendorCreditMemoLineRequest[] = this.lines().map(l => ({
      vendorBillLineId: l.vendorBillLineId,
      partId: l.partId,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    }));
    const common = {
      kind: f.kind,
      sourceType: f.sourceType,
      reason: f.reason.trim(),
      vendorReference: f.vendorReference.trim() || null,
      taxAmount: f.taxAmount ?? 0,
      notes: f.notes.trim() || null,
      lines,
    };
    this.saving.set(true);
    const memo = this.memo();
    const request$ = memo
      ? this.service.update(memo.id, { ...common, memoDate: toIsoDate(f.memoDate)! }, memo.rowVersion)
      : this.service.create({
        ...common,
        vendorId: f.vendorId!,
        vendorBillId: this.bill()?.id ?? null,
        memoDate: toIsoDate(f.memoDate),
        currencyId: this.bill() ? null : f.currencyId,
        fxRate: this.bill() ? null : f.fxRate,
      });
    request$.subscribe({
      next: saved => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(memo ? 'vendorCredits.updated' : 'vendorCredits.created', { number: saved.memoNumber }));
        this.saved.emit(saved.id);
      },
      error: () => this.saving.set(false),
    });
  }
}
