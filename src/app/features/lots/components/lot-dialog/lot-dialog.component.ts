import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { LotService } from '../../services/lot.service';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';

@Component({
  selector: 'app-lot-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent, InputComponent, TextareaComponent, DatepickerComponent,
    EntityPickerComponent, ValidationPopoverDirective, TranslatePipe,
  ],
  templateUrl: './lot-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LotDialogComponent {
  private readonly service = inject(LotService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    partId: new FormControl<number | null>(null, [Validators.required]),
    quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0.0001)]),
    jobId: new FormControl<number | null>(null),
    supplierLotNumber: new FormControl(''),
    expirationDate: new FormControl<Date | null>(null),
    notes: new FormControl(''),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    partId: 'Part',
    quantity: 'Quantity',
  });

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const f = this.form.getRawValue();

    this.service.create({
      partId: f.partId!,
      quantity: f.quantity!,
      jobId: f.jobId ?? null,
      supplierLotNumber: f.supplierLotNumber || null,
      expirationDate: f.expirationDate ? toIsoDate(f.expirationDate) : null,
      notes: f.notes || null,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('lots.created'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
