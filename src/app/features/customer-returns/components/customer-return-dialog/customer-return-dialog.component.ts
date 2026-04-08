import { ChangeDetectionStrategy, Component, inject, input, output, signal, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CustomerReturnService } from '../../services/customer-return.service';
import { CustomerReturnDetail } from '../../models/customer-return-detail.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';

@Component({
  selector: 'app-customer-return-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent, InputComponent, TextareaComponent, DatepickerComponent,
    EntityPickerComponent, ValidationPopoverDirective, TranslatePipe,
  ],
  templateUrl: './customer-return-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerReturnDialogComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;
  private readonly service = inject(CustomerReturnService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly returnDetail = input<CustomerReturnDetail | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);

  protected readonly returnForm = new FormGroup({
    customerId: new FormControl<number | null>(null, [Validators.required]),
    originalJobId: new FormControl<number | null>(null, [Validators.required]),
    reason: new FormControl('', [Validators.required, Validators.maxLength(500)]),
    notes: new FormControl(''),
    returnDate: new FormControl<Date | null>(new Date(), [Validators.required]),
  });

  protected readonly violations = FormValidationService.getViolations(this.returnForm, {
    customerId: 'Customer',
    originalJobId: 'Original Job',
    reason: 'Reason',
    returnDate: 'Return Date',
  });

  protected get draftConfig(): DraftConfig {
    return {
      entityType: 'customer-return',
      entityId: this.returnDetail()?.id?.toString() ?? 'new',
      route: '/customer-returns',
    };
  }

  constructor() {
    const r = this.returnDetail();
    if (r) {
      this.returnForm.patchValue({
        customerId: r.customerId,
        originalJobId: r.originalJobId,
        reason: r.reason,
        notes: r.notes ?? '',
        returnDate: r.returnDate ?? null,
      });
    }
  }

  protected get isEditing(): boolean {
    return this.returnDetail() !== null;
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.returnForm.invalid) return;
    this.saving.set(true);
    const f = this.returnForm.getRawValue();
    const r = this.returnDetail();

    if (r) {
      this.service.update(r.id, {
        reason: f.reason ?? undefined,
        notes: f.notes ?? undefined,
        returnDate: f.returnDate ? (toIsoDate(f.returnDate) ?? undefined) : undefined,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogRef.clearDraft();
          this.snackbar.success(this.translate.instant('customerReturns.updated'));
          this.saved.emit();
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.service.create({
        customerId: f.customerId!,
        originalJobId: f.originalJobId!,
        reason: f.reason!,
        notes: f.notes || undefined,
        returnDate: toIsoDate(f.returnDate ?? new Date()) ?? '',
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogRef.clearDraft();
          this.snackbar.success(this.translate.instant('customerReturns.created'));
          this.saved.emit();
        },
        error: () => this.saving.set(false),
      });
    }
  }
}
