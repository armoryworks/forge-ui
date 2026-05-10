import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';

export interface CallbackSchedulerResult {
  callbackAt: string; // ISO
}

/**
 * Phase 1r / Batch 6 follow-up — replace the previous hardcoded
 * "now + 24h" with an explicit operator-picked date + time slot.
 * Default is still tomorrow morning so the common case is two
 * Enters away; advanced cases (specific time-of-day, multi-day
 * delay) are now expressible.
 */
@Component({
  selector: 'app-callback-scheduler-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, DatepickerComponent, SelectComponent, ValidationButtonComponent,
  ],
  templateUrl: './callback-scheduler-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CallbackSchedulerDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CallbackSchedulerDialogComponent, CallbackSchedulerResult | undefined>);

  // 30-minute increments from 7 AM to 6 PM cover the practical work-hour
  // range; admins can extend later if the install needs after-hours.
  protected readonly timeOptions: SelectOption[] = (() => {
    const opts: SelectOption[] = [];
    for (let h = 7; h <= 18; h++) {
      for (const m of [0, 30]) {
        const label = `${h % 12 === 0 ? 12 : h % 12}:${m === 0 ? '00' : '30'} ${h < 12 ? 'AM' : 'PM'}`;
        opts.push({ value: `${h}:${m}`, label });
      }
    }
    return opts;
  })();

  protected readonly form = new FormGroup({
    callbackDate: new FormControl<Date | null>(this.defaultTomorrow(), [Validators.required]),
    callbackTime: new FormControl<string>('9:0', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    callbackDate: 'Callback date',
    callbackTime: 'Callback time',
  });

  private defaultTomorrow(): Date {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(9, 0, 0, 0);
    return t;
  }

  protected cancel(): void {
    this.dialogRef.close();
  }

  protected confirm(): void {
    if (this.form.invalid) return;
    const f = this.form.getRawValue();
    const date = f.callbackDate!;
    const [h, m] = f.callbackTime.split(':').map(s => Number(s));
    const callbackAt = new Date(date);
    callbackAt.setHours(h, m, 0, 0);
    this.dialogRef.close({ callbackAt: callbackAt.toISOString() });
  }
}
