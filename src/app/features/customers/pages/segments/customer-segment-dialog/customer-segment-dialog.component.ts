import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';
import { CustomerSegmentService } from '../../../services/customer-segment.service';
import { CustomerSegment } from '../../../models/customer-segment.model';

/** Data: the segment to edit, or null to create a new one. */
export interface CustomerSegmentDialogData {
  segment: CustomerSegment | null;
}

/** Result: the saved segment, or undefined when cancelled. */
export type CustomerSegmentDialogResult = CustomerSegment | undefined;

/** Create or edit a customer segment (saved named filter). */
@Component({
  selector: 'app-customer-segment-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, TextareaComponent, ToggleComponent, ValidationButtonComponent],
  templateUrl: './customer-segment-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerSegmentDialogComponent {
  protected readonly data = inject<CustomerSegmentDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CustomerSegmentDialogComponent, CustomerSegmentDialogResult>);
  private readonly service = inject(CustomerSegmentService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly isEdit = this.data.segment != null;
  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    name: new FormControl(this.data.segment?.name ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    description: new FormControl<string>(this.data.segment?.description ?? '', { nonNullable: true }),
    filterCriteria: new FormControl<string>(this.data.segment?.filterCriteria ?? '', { nonNullable: true }),
    isActive: new FormControl(this.data.segment?.isActive ?? true, { nonNullable: true }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: 'Name',
  });

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const body = {
      name: v.name.trim(),
      description: v.description.trim() || null,
      filterCriteria: v.filterCriteria.trim() || null,
      isActive: v.isActive,
    };
    this.saving.set(true);
    const req = this.isEdit
      ? this.service.updateSegment(this.data.segment!.id, body)
      : this.service.createSegment(body);
    req.subscribe({
      next: (seg) => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(this.isEdit ? 'customers.segmentsPage.updated' : 'customers.segmentsPage.created'));
        this.dialogRef.close(seg);
      },
      error: () => this.saving.set(false),
    });
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
