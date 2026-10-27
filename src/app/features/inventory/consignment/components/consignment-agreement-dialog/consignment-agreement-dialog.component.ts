import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConsignmentService } from '../../services/consignment.service';
import { ConsignmentAgreement } from '../../models/consignment-agreement.model';
import { ConsignmentAgreementStatus } from '../../models/consignment-agreement-status.type';
import { DialogComponent } from '../../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../../shared/components/datepicker/datepicker.component';
import { TextareaComponent } from '../../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../../shared/components/toggle/toggle.component';
import { CurrencyInputComponent } from '../../../../../shared/components/currency-input/currency-input.component';
import { EntityPickerComponent } from '../../../../../shared/components/entity-picker/entity-picker.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { fromIsoDate, toDateOnly, todayStart } from '../../../../../shared/utils/date.utils';

const STATUSES: ConsignmentAgreementStatus[] = ['Draft', 'Active', 'Suspended', 'Expired', 'Terminated'];

@Component({
  selector: 'app-consignment-agreement-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, DatepickerComponent, TextareaComponent, ToggleComponent,
    CurrencyInputComponent, EntityPickerComponent, ValidationButtonComponent,
  ],
  templateUrl: './consignment-agreement-dialog.component.html',
  styleUrl: './consignment-agreement-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsignmentAgreementDialogComponent implements OnInit {
  private readonly service = inject(ConsignmentService);
  private readonly translate = inject(TranslateService);

  readonly agreement = input<ConsignmentAgreement | null>(null);
  readonly closed = output<void>();
  readonly saved = output<ConsignmentAgreement>();

  protected readonly saving = signal(false);
  protected readonly editing = computed(() => this.agreement() !== null);
  protected readonly statusOptions: SelectOption[] = STATUSES.map(s => ({
    value: s, label: this.translate.instant(`consignment.status.${s}`),
  }));

  protected readonly form = new FormGroup({
    vendorId: new FormControl<number | null>(null, [Validators.required]),
    partId: new FormControl<number | null>(null, [Validators.required]),
    agreedUnitPrice: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    minStockQuantity: new FormControl<number | null>(null, [Validators.min(0)]),
    maxStockQuantity: new FormControl<number | null>(null, [Validators.min(0)]),
    effectiveFrom: new FormControl<Date | null>(todayStart(), [Validators.required]),
    effectiveTo: new FormControl<Date | null>(null),
    invoiceOnConsumption: new FormControl<boolean>(true, { nonNullable: true }),
    reconciliationFrequencyDays: new FormControl<number | null>(30, [Validators.required, Validators.min(1)]),
    status: new FormControl<ConsignmentAgreementStatus>('Active', { nonNullable: true }),
    terms: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(4000)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    vendorId: this.translate.instant('consignment.vendor'),
    partId: this.translate.instant('common.part'),
    agreedUnitPrice: this.translate.instant('consignment.agreedPrice'),
    effectiveFrom: this.translate.instant('consignment.effectiveFrom'),
    reconciliationFrequencyDays: this.translate.instant('consignment.reconcileEvery'),
  });

  ngOnInit(): void {
    const a = this.agreement();
    if (!a) return;
    this.form.patchValue({
      vendorId: a.vendorId,
      partId: a.partId,
      agreedUnitPrice: a.agreedUnitPrice,
      minStockQuantity: a.minStockQuantity,
      maxStockQuantity: a.maxStockQuantity,
      effectiveFrom: fromIsoDate(a.effectiveFrom),
      effectiveTo: fromIsoDate(a.effectiveTo),
      invoiceOnConsumption: a.invoiceOnConsumption,
      reconciliationFrequencyDays: a.reconciliationFrequencyDays,
      status: a.status,
      terms: a.terms ?? '',
    });
    this.form.controls.vendorId.disable();
    this.form.controls.partId.disable();
    this.form.controls.effectiveFrom.disable();
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) return;
    const f = this.form.getRawValue();
    const common = {
      agreedUnitPrice: f.agreedUnitPrice ?? 0,
      minStockQuantity: f.minStockQuantity,
      maxStockQuantity: f.maxStockQuantity,
      effectiveTo: toDateOnly(f.effectiveTo),
      invoiceOnConsumption: f.invoiceOnConsumption,
      terms: f.terms.trim() || null,
      reconciliationFrequencyDays: f.reconciliationFrequencyDays ?? 30,
    };
    const existing = this.agreement();
    const request$ = existing
      ? this.service.update(existing.id, { ...common, status: f.status })
      : this.service.create({
        ...common,
        direction: 'Inbound',
        vendorId: f.vendorId!,
        partId: f.partId!,
        effectiveFrom: toDateOnly(f.effectiveFrom)!,
      });
    this.saving.set(true);
    request$.subscribe({
      next: saved => {
        this.saving.set(false);
        this.saved.emit(saved);
      },
      error: () => this.saving.set(false),
    });
  }
}
