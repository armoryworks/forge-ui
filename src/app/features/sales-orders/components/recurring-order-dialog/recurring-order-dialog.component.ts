import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CreateRecurringOrderRequest } from '../../models/recurring-order.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';

@Component({
  selector: 'app-recurring-order-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, TextareaComponent, DatepickerComponent,
    EntityPickerComponent, ValidationButtonComponent,
  ],
  templateUrl: './recurring-order-dialog.component.html',
  styleUrl: './recurring-order-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurringOrderDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<RecurringOrderDialogComponent, CreateRecurringOrderRequest | undefined>);
  private readonly translate = inject(TranslateService);

  protected readonly form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    customerId: new FormControl<number | null>(null, [Validators.required]),
    intervalDays: new FormControl<number>(30, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(365)] }),
    nextGenerationDate: new FormControl<Date | null>(this.defaultNextDate(), [Validators.required]),
    notes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    lines: new FormArray<FormGroup>([this.buildLine()]),
  });

  protected get lines(): FormArray<FormGroup> {
    return this.form.controls.lines;
  }

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('salesOrders.recurring.fieldName'),
    customerId: this.translate.instant('salesOrders.recurring.fieldCustomer'),
    intervalDays: this.translate.instant('salesOrders.recurring.fieldInterval'),
    nextGenerationDate: this.translate.instant('salesOrders.recurring.fieldNextRun'),
  });

  private buildLine(): FormGroup {
    return new FormGroup({
      partId: new FormControl<number | null>(null, [Validators.required]),
      description: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
      quantity: new FormControl<number>(1, { nonNullable: true, validators: [Validators.required, Validators.min(0.0001)] }),
      unitPrice: new FormControl<number>(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    });
  }

  private defaultNextDate(): Date {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  protected addLine(): void { this.lines.push(this.buildLine()); this.form.markAsDirty(); }
  protected removeLine(i: number): void {
    if (this.lines.length <= 1) return; // Keep at least one line
    this.lines.removeAt(i);
    this.form.markAsDirty();
  }

  protected close(): void { this.dialogRef.close(); }

  protected save(): void {
    if (this.form.invalid) return;
    const f = this.form.getRawValue();
    const isoDate = toIsoDate(f.nextGenerationDate) ?? '';
    const payload: CreateRecurringOrderRequest = {
      name: f.name.trim(),
      customerId: f.customerId!,
      intervalDays: f.intervalDays,
      nextGenerationDate: isoDate,
      notes: f.notes.trim() || null,
      lines: this.lines.controls.map(c => {
        const v = c.getRawValue() as { partId: number; description: string; quantity: number; unitPrice: number };
        return {
          partId: v.partId,
          description: v.description.trim(),
          quantity: v.quantity,
          unitPrice: v.unitPrice,
        };
      }),
    };
    this.dialogRef.close(payload);
  }
}
