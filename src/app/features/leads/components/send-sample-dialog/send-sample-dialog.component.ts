import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate, todayStart } from '../../../../shared/utils/date.utils';
import { SampleShipmentsService } from '../../services/sample-shipments.service';
import { SampleShipment } from '../../models/sample-shipment.model';

export interface SendSampleDialogData {
  leadId?: number;
  customerId?: number;
  recipientName: string;
  shipToAddress?: string;
}

/**
 * Sends a sample part to a lead or an existing customer: the part (or a description), quantity, ship-to
 * address, carrier and tracking, and when to follow up. With a tracking number the sample is recorded as
 * shipped; without one it starts as requested. Closes with the created sample, or `undefined`.
 */
@Component({
  selector: 'app-send-sample-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, DatepickerComponent, EntityPickerComponent, InputComponent, TextareaComponent, ValidationButtonComponent,
  ],
  templateUrl: './send-sample-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendSampleDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<SendSampleDialogComponent, SampleShipment | undefined>);
  private readonly samples = inject(SampleShipmentsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly data = inject<SendSampleDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);
  protected readonly today = todayStart();

  protected readonly form = new FormGroup({
    partId: new FormControl<number | null>(null),
    partDescription: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
    quantity: new FormControl<number>(1, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)] }),
    shipToAddress: new FormControl<string>(this.data.shipToAddress ?? '', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    carrier: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    trackingNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    followUpDate: new FormControl<Date | null>(null),
    notes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    partDescription: this.translate.instant('leads.sendSample.description'),
    quantity: this.translate.instant('leads.sendSample.quantity'),
    shipToAddress: this.translate.instant('leads.sendSample.shipTo'),
    carrier: this.translate.instant('leads.sendSample.carrier'),
    trackingNumber: this.translate.instant('leads.sendSample.tracking'),
    notes: this.translate.instant('common.notes'),
  });

  protected onPartPicked(part: Record<string, unknown> | null): void {
    if (!part) return;
    const name = String(part['name'] ?? part['partNumber'] ?? '');
    if (name && !this.form.controls.partDescription.value.trim()) this.form.controls.partDescription.setValue(name);
  }

  protected cancel(): void {
    this.dialogRef.close();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const f = this.form.getRawValue();
    this.saving.set(true);
    this.samples.create({
      leadId: this.data.leadId ?? null,
      customerId: this.data.customerId ?? null,
      partId: f.partId,
      partDescription: f.partDescription.trim(),
      quantity: Number(f.quantity),
      shipToAddress: f.shipToAddress.trim() || null,
      carrier: f.carrier.trim() || null,
      trackingNumber: f.trackingNumber.trim() || null,
      followUpDate: f.followUpDate ? toIsoDate(f.followUpDate) : null,
      notes: f.notes.trim() || null,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(
          created.status === 'Shipped' ? 'leads.sendSample.shipped' : 'leads.sendSample.requested'));
        this.dialogRef.close(created);
      },
      error: () => this.saving.set(false),
    });
  }
}
