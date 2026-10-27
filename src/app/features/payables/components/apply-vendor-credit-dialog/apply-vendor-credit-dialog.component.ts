import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, map, of } from 'rxjs';

import { VendorCreditMemoService } from '../../services/vendor-credit-memo.service';
import { VendorBillService } from '../../services/vendor-bill.service';
import { VendorCreditMemoDetail } from '../../models/vendor-credit-memo-detail.model';
import { VendorBillListItem } from '../../models/vendor-bill-list-item.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { roundMoney } from '../../../../shared/utils/money.utils';

/** Applies part of an open vendor memo to an approved bill of the same vendor and currency. */
@Component({
  selector: 'app-apply-vendor-credit-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, SelectComponent, CurrencyDisplayComponent, ValidationButtonComponent],
  templateUrl: './apply-vendor-credit-dialog.component.html',
  styleUrl: './apply-vendor-credit-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplyVendorCreditDialogComponent implements OnInit {
  private readonly service = inject(VendorCreditMemoService);
  private readonly billService = inject(VendorBillService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly memo = input.required<VendorCreditMemoDetail>();
  readonly closed = output<void>();
  readonly applied = output<VendorCreditMemoDetail>();

  protected readonly saving = signal(false);
  protected readonly bills = signal<VendorBillListItem[]>([]);
  protected readonly loaded = signal(false);

  protected readonly billOptions = computed<SelectOption[]>(() => this.bills().map(b => ({
    value: b.id,
    label: this.translate.instant('vendorCredits.billOption', { number: b.billNumber, balance: b.balanceDue.toFixed(2) }),
  })));

  protected readonly form = new FormGroup({
    vendorBillId: new FormControl<number | null>(null, [Validators.required]),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    vendorBillId: this.translate.instant('vendorCredits.bill'),
    amount: this.translate.instant('vendorCredits.applyAmount'),
  });

  ngOnInit(): void {
    const memo = this.memo();
    this.billService.getVendorBills(memo.vendorId).pipe(
      map(list => list.filter(b => (b.status === 'Approved' || b.status === 'PartiallyPaid') && b.balanceDue > 0
        && (b.currencyId == null || b.currencyId === memo.currencyId))),
      catchError(() => of<VendorBillListItem[]>([])),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(list => {
      this.bills.set(list);
      this.loaded.set(true);
    });

    this.form.controls.vendorBillId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(id => {
      const bill = this.bills().find(b => b.id === id);
      if (bill) this.form.controls.amount.setValue(roundMoney(Math.min(bill.balanceDue, this.memo().openAmount)));
    });
  }

  protected canSave(): boolean {
    const bill = this.bills().find(b => b.id === this.form.controls.vendorBillId.value);
    const amount = roundMoney(this.form.controls.amount.value ?? 0);
    return this.form.valid && !!bill && amount <= this.memo().openAmount && amount <= bill.balanceDue;
  }

  protected save(): void {
    if (!this.canSave() || this.saving()) return;
    const f = this.form.getRawValue();
    this.saving.set(true);
    this.service.apply(this.memo().id, f.vendorBillId!, roundMoney(f.amount!)).subscribe({
      next: memo => {
        this.saving.set(false);
        this.applied.emit(memo);
      },
      error: () => this.saving.set(false),
    });
  }
}
