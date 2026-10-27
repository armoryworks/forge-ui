import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { fromIsoDate, toIsoDate } from '../../../../shared/utils/date.utils';
import { LotService } from '../../services/lot.service';

/** Corrects a lot's expiry date, supplier lot number and notes. */
@Component({
  selector: 'app-lot-edit-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DatepickerComponent, DialogComponent, InputComponent, TextareaComponent, ValidationButtonComponent],
  templateUrl: './lot-edit-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LotEditDialogComponent implements OnInit {
  private readonly lotService = inject(LotService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);

  readonly lotId = input.required<number>();
  readonly lotNumber = input.required<string>();
  readonly expirationDate = input<Date | string | null>(null);
  readonly supplierLotNumber = input<string | null>(null);
  readonly notes = input<string | null>(null);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly form = new FormGroup({
    expirationDate: new FormControl<Date | null>(null),
    supplierLotNumber: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });
  protected readonly violations = FormValidationService.getViolations(this.form, {
    supplierLotNumber: this.translate.instant('lots.supplierLot'),
    notes: this.translate.instant('common.notes'),
  });

  ngOnInit(): void {
    this.form.reset({
      expirationDate: fromIsoDate(this.expirationDate()),
      supplierLotNumber: this.supplierLotNumber() ?? '',
      notes: this.notes() ?? '',
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.lotService.update(this.lotId(), {
      expirationDate: toIsoDate(v.expirationDate),
      supplierLotNumber: v.supplierLotNumber.trim() || null,
      notes: v.notes.trim() || null,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('inventoryScreens.lots.saved', { lot: this.lotNumber() }));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
