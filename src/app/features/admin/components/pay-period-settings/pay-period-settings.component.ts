import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, startWith } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { fromIsoDate, toDateOnly, toIsoDate } from '../../../../shared/utils/date.utils';
import { PayPeriodPreview } from '../../../time-tracking/models/pay-period-preview.model';
import { TimeTrackingService } from '../../../time-tracking/services/time-tracking.service';

const ANCHORED_TYPES = ['weekly', 'biweekly'];

@Component({
  selector: 'app-pay-period-settings',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DateOnlyPipe, SelectComponent, DatepickerComponent, ValidationButtonComponent],
  templateUrl: './pay-period-settings.component.html',
  styleUrl: './pay-period-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PayPeriodSettingsComponent {
  private readonly service = inject(TimeTrackingService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly capabilities = inject(CapabilityService);

  protected readonly enabled = computed(() => this.capabilities.isEnabled('CAP-HR-TIMETRACK', true));

  protected readonly typeOptions: SelectOption[] = [
    { value: 'weekly', label: this.translate.instant('timePay.types.weekly') },
    { value: 'biweekly', label: this.translate.instant('timePay.types.biweekly') },
    { value: 'semimonthly', label: this.translate.instant('timePay.types.semimonthly') },
    { value: 'monthly', label: this.translate.instant('timePay.types.monthly') },
  ];

  protected readonly form = new FormGroup({
    type: new FormControl('biweekly', { nonNullable: true, validators: [Validators.required] }),
    anchorDate: new FormControl<Date | null>(null),
  });
  protected readonly violations = FormValidationService.getViolations(this.form, {
    type: this.translate.instant('timePay.periodType'),
  });

  private readonly typeValue = toSignal(this.form.controls.type.valueChanges.pipe(startWith(this.form.controls.type.value)));
  protected readonly usesAnchor = computed(() => ANCHORED_TYPES.includes(this.typeValue() ?? ''));
  protected readonly preview = signal<PayPeriodPreview[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);

  constructor() {
    if (!this.enabled()) return;
    this.loading.set(true);
    this.service.getCurrentPayPeriod().subscribe({
      next: current => {
        this.form.reset({
          type: current.type?.toLowerCase() || 'biweekly',
          anchorDate: fromIsoDate(current.anchorDate ?? null),
        });
        this.loading.set(false);
        this.loadPreview();
      },
      error: (err: unknown) => { this.loading.set(false); this.snackbar.errorFrom(err, 'timePay.loadFailed'); },
    });
    this.form.valueChanges.pipe(debounceTime(250), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadPreview());
  }

  protected loadPreview(): void {
    const v = this.form.getRawValue();
    const anchor = ANCHORED_TYPES.includes(v.type) ? toDateOnly(v.anchorDate) : null;
    this.service.previewPayPeriods(v.type, anchor).subscribe({
      next: periods => this.preview.set(periods),
      error: () => this.preview.set([]),
    });
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const anchor = ANCHORED_TYPES.includes(v.type) ? toIsoDate(v.anchorDate) ?? undefined : undefined;
    this.saving.set(true);
    this.service.updatePayPeriodSettings(v.type, anchor).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.markAsPristine();
        this.snackbar.success(this.translate.instant('timePay.saved'));
      },
      error: (err: unknown) => { this.saving.set(false); this.snackbar.errorFrom(err, 'timePay.saveFailed'); },
    });
  }
}
