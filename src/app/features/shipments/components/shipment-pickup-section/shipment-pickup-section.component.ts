import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MatDialog } from '@angular/material/dialog';

import { ShipmentService } from '../../services/shipment.service';
import { ShipmentDetail } from '../../models/shipment-detail.model';
import { PickupOrigin } from '../../models/pickup-origin.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { zonedWallTimeToIso } from '../../../../shared/utils/zoned-date-time';
import { DateTimePipe } from '../../../../shared/pipes/date-time.pipe';

/**
 * Carrier pickup for a shipment on an integrated carrier: schedule one for a day and a ready-to-close window
 * (wall-clock times at the pickup location, sent with that location's UTC offset), show the carrier's
 * confirmation number, and cancel it.
 */
@Component({
  selector: 'app-shipment-pickup-section',
  standalone: true,
  imports: [
    DateTimePipe, ReactiveFormsModule, TranslatePipe,
    DialogComponent, DatepickerComponent, InputComponent, TextareaComponent, ValidationButtonComponent,
  ],
  templateUrl: './shipment-pickup-section.component.html',
  styleUrl: './shipment-pickup-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShipmentPickupSectionComponent {
  private readonly shipmentService = inject(ShipmentService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly shipment = input.required<ShipmentDetail>();
  readonly changed = output<void>();

  protected readonly showForm = signal(false);
  protected readonly saving = signal(false);
  protected readonly origin = signal<PickupOrigin | null>(null);

  protected readonly canSchedule = computed(() => {
    const s = this.shipment();
    return s.carrierIsApi && !s.pickupConfirmationNumber && (s.status === 'Pending' || s.status === 'Packed');
  });

  protected readonly form = new FormGroup({
    date: new FormControl<Date | null>(null, [Validators.required]),
    readyTime: new FormControl<string>('09:00', { nonNullable: true, validators: [Validators.required] }),
    closeTime: new FormControl<string>('17:00', { nonNullable: true, validators: [Validators.required] }),
    instructions: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  }, { validators: (group: AbstractControl) => this.windowOrder(group) });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    date: this.translate.instant('shipments.pickup.date'),
    readyTime: this.translate.instant('shipments.pickup.readyTime'),
    closeTime: this.translate.instant('shipments.pickup.closeTime'),
    instructions: this.translate.instant('shipments.pickup.instructions'),
  });

  protected openSchedule(): void {
    this.form.reset({ date: new Date(), readyTime: '09:00', closeTime: '17:00', instructions: '' });
    this.showForm.set(true);
    this.shipmentService.getPickupOrigin().subscribe({
      next: origin => this.origin.set(origin),
      error: () => this.origin.set({ locationName: null, timeZone: null }),
    });
  }

  protected closeForm(): void {
    this.showForm.set(false);
  }

  protected schedule(): void {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const zone = this.origin()?.timeZone ?? null;
    this.saving.set(true);
    this.shipmentService.schedulePickup(this.shipment().id, {
      readyTime: zonedWallTimeToIso(v.date!, v.readyTime, zone),
      closeTime: zonedWallTimeToIso(v.date!, v.closeTime, zone),
      instructions: v.instructions.trim() || null,
    }).subscribe({
      next: confirmation => {
        this.saving.set(false);
        this.showForm.set(false);
        this.snackbar.success(this.translate.instant('shipments.pickup.scheduled', { number: confirmation.confirmationNumber }));
        this.changed.emit();
      },
      error: (err: unknown) => { this.saving.set(false); this.snackbar.errorFrom(err, 'shipments.pickup.scheduleFailed'); },
    });
  }

  protected cancelPickup(): void {
    const s = this.shipment();
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('shipments.pickup.cancelTitle'),
        message: this.translate.instant('shipments.pickup.cancelMessage', { number: s.pickupConfirmationNumber }),
        confirmLabel: this.translate.instant('shipments.pickup.cancel'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.shipmentService.cancelPickup(s.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('shipments.pickup.cancelled'));
          this.changed.emit();
        },
        error: (err: unknown) => this.snackbar.errorFrom(err, 'shipments.pickup.cancelFailed'),
      });
    });
  }

  private windowOrder(group: AbstractControl): ValidationErrors | null {
    const ready = group.get('readyTime')?.value as string | undefined;
    const close = group.get('closeTime')?.value as string | undefined;
    return ready && close && close <= ready
      ? { pickupWindow: { message: this.translate.instant('shipments.pickup.windowOrder'), field: 'closeTime' } }
      : null;
  }
}
