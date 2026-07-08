import { ChangeDetectionStrategy, Component, Signal, computed, inject, signal } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators,
} from '@angular/forms';
import { DecimalPipe } from '@angular/common';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { startWith } from 'rxjs';

import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { PaymentMilestone } from '../../../../shared/models/payment-milestone.model';
import { PaymentSchedule } from '../../../../shared/models/payment-schedule.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { PaymentScheduleService } from '../../services/payment-schedule.service';
import { PaymentDueTrigger } from '../../models/payment-due-trigger.model';
import { UpsertPaymentScheduleRequest } from '../../models/upsert-payment-schedule-request.model';

export interface PaymentScheduleDialogData {
  quoteId: number;
  /** Live quote total — drives the per-row derived amount preview. */
  quoteTotal: number;
  /** Existing schedule to edit, or null to author a new one. */
  schedule: PaymentSchedule | null;
}

/** Result: the saved schedule (dialog resolves undefined on cancel). */
export type PaymentScheduleDialogResult = PaymentSchedule;

interface MilestoneRowControls {
  name: FormControl<string>;
  percentage: FormControl<number | null>;
  dueTrigger: FormControl<PaymentDueTrigger>;
  dueDate: FormControl<Date | null>;
  netDays: FormControl<number | null>;
  notes: FormControl<string>;
}

type MilestoneRowGroup = FormGroup<MilestoneRowControls>;

/** Template render model per row — trigger + derived amount, recomputed on every form change. */
interface RowView {
  trigger: PaymentDueTrigger;
  amount: number;
}

const MAX_MILESTONES = 20;

const PAYMENT_DUE_TRIGGERS: PaymentDueTrigger[] = [
  'OnAcceptance', 'OnOrderConfirmation', 'OnProductionStart',
  'OnShipment', 'OnDelivery', 'FixedDate', 'NetDays',
];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** FixedDate needs a due date; NetDays needs a positive day count. */
function triggerFieldsValidator(group: AbstractControl): ValidationErrors | null {
  const trigger = group.get('dueTrigger')?.value as PaymentDueTrigger | undefined;
  if (trigger === 'FixedDate' && !group.get('dueDate')?.value) {
    return { fixedDateRequired: true };
  }
  if (trigger === 'NetDays') {
    const netDays = group.get('netDays')?.value as number | null | undefined;
    if (netDays === null || netDays === undefined || Number(netDays) < 1) {
      return { netDaysRequired: true };
    }
  }
  return null;
}

/** Σ percentage must equal 100 (2-dp tolerance) and at least one row must exist. */
function scheduleSumValidator(control: AbstractControl): ValidationErrors | null {
  const arr = control as FormArray;
  if (arr.length === 0) return { noRows: true };
  const sum = round2(arr.controls.reduce((s, g) => s + (Number(g.get('percentage')?.value) || 0), 0));
  return Math.abs(sum - 100) > 0.005 ? { sumNot100: { sum } } : null;
}

/**
 * S2 schedule editor — FormArray of milestone rows PUT as a bulk replace.
 * The server 409s when any existing milestone is locked (Invoiced /
 * PartiallyPaid / Paid); the global interceptor toasts that message, so this
 * dialog only resets its saving state on error (no double-toast).
 */
@Component({
  selector: 'app-payment-schedule-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, DatepickerComponent,
    CurrencyDisplayComponent, ValidationButtonComponent,
  ],
  templateUrl: './payment-schedule-dialog.component.html',
  styleUrl: './payment-schedule-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentScheduleDialogComponent {
  private readonly paymentScheduleService = inject(PaymentScheduleService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef =
    inject(MatDialogRef<PaymentScheduleDialogComponent, PaymentScheduleDialogResult | undefined>);
  protected readonly data = inject<PaymentScheduleDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);
  protected readonly maxMilestones = MAX_MILESTONES;

  protected readonly milestonesArray = new FormArray<MilestoneRowGroup>([], { validators: [scheduleSumValidator] });
  protected readonly form = new FormGroup({ milestones: this.milestonesArray });

  // Re-emitting spine for all form-derived computeds (zoneless OnPush —
  // control reads in templates are not reactive on their own).
  private readonly arrayChanges = toSignal(this.milestonesArray.valueChanges, { initialValue: null });

  protected readonly rowViews = computed<RowView[]>(() => {
    this.arrayChanges();
    return this.milestonesArray.controls.map(g => ({
      trigger: g.controls.dueTrigger.value,
      amount: round2(((Number(g.controls.percentage.value) || 0) / 100) * this.data.quoteTotal),
    }));
  });

  protected readonly sumPct = computed(() => {
    this.arrayChanges();
    return round2(this.milestonesArray.controls.reduce(
      (s, g) => s + (Number(g.controls.percentage.value) || 0), 0));
  });

  protected readonly sumOk = computed(() => Math.abs(this.sumPct() - 100) <= 0.005);

  protected readonly triggerOptions: SelectOption[] = PAYMENT_DUE_TRIGGERS.map(trigger => ({
    value: trigger,
    label: this.translate.instant(`quotes.paymentSchedule.trigger${trigger}`),
  }));

  // Custom violations signal: FormValidationService only scans top-level
  // controls, so FormArray row errors need this bespoke collector.
  private readonly violationsState = signal<string[]>([]);
  protected readonly violations: Signal<string[]> = this.violationsState.asReadonly();

  constructor() {
    const existing = this.data.schedule;
    if (existing && existing.milestones.length > 0) {
      for (const m of existing.milestones) this.milestonesArray.push(this.buildRow(m));
    } else {
      this.milestonesArray.push(this.buildRow());
    }

    this.form.statusChanges
      .pipe(startWith(this.form.status), takeUntilDestroyed())
      .subscribe(() => this.violationsState.set(this.collectViolations()));
  }

  protected addRow(): void {
    if (this.milestonesArray.length >= MAX_MILESTONES) return;
    this.milestonesArray.push(this.buildRow());
    this.form.markAsDirty();
  }

  protected removeRow(index: number): void {
    if (this.milestonesArray.length <= 1) return;
    this.milestonesArray.removeAt(index);
    this.form.markAsDirty();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const request: UpsertPaymentScheduleRequest = {
      milestones: this.milestonesArray.controls.map(g => {
        const v = g.getRawValue();
        return {
          name: v.name.trim(),
          percentage: Number(v.percentage) || 0,
          dueTrigger: v.dueTrigger,
          dueDate: v.dueTrigger === 'FixedDate' ? toIsoDate(v.dueDate) ?? undefined : undefined,
          netDays: v.dueTrigger === 'NetDays' ? v.netDays ?? undefined : undefined,
          notes: v.notes.trim() || undefined,
        };
      }),
    };

    this.paymentScheduleService.upsert(this.data.quoteId, request).subscribe({
      next: (schedule) => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('quotes.paymentSchedule.scheduleSaved'));
        this.dialogRef.close(schedule);
      },
      // 409 (locked milestone) and validation rejections are toasted by the
      // global HttpErrorInterceptor with the server message — don't re-toast.
      error: () => this.saving.set(false),
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }

  private buildRow(m?: PaymentMilestone): MilestoneRowGroup {
    return new FormGroup<MilestoneRowControls>({
      name: new FormControl(m?.name ?? '', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(100)],
      }),
      percentage: new FormControl<number | null>(m?.percentage ?? null, [
        Validators.required, Validators.min(0.01), Validators.max(100),
      ]),
      dueTrigger: new FormControl<PaymentDueTrigger>(
        (m?.dueTrigger as PaymentDueTrigger) ?? 'OnAcceptance',
        { nonNullable: true, validators: [Validators.required] },
      ),
      dueDate: new FormControl<Date | null>(m?.dueDate ? new Date(m.dueDate) : null),
      netDays: new FormControl<number | null>(m?.netDays ?? null),
      notes: new FormControl(m?.notes ?? '', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    }, { validators: [triggerFieldsValidator] });
  }

  private collectViolations(): string[] {
    const out: string[] = [];
    this.milestonesArray.controls.forEach((g, i) => {
      const row = i + 1;
      if (g.controls.name.hasError('required')) {
        out.push(this.translate.instant('quotes.paymentSchedule.rowNameRequired', { row }));
      }
      if (g.controls.percentage.invalid) {
        out.push(this.translate.instant('quotes.paymentSchedule.rowPercentageInvalid', { row }));
      }
      if (g.hasError('fixedDateRequired')) {
        out.push(this.translate.instant('quotes.paymentSchedule.rowDueDateRequired', { row }));
      }
      if (g.hasError('netDaysRequired')) {
        out.push(this.translate.instant('quotes.paymentSchedule.rowNetDaysRequired', { row }));
      }
    });
    if (this.milestonesArray.hasError('noRows')) {
      out.push(this.translate.instant('quotes.paymentSchedule.atLeastOneMilestone'));
    }
    const sumError = this.milestonesArray.getError('sumNot100') as { sum: number } | null;
    if (sumError) {
      out.push(this.translate.instant('quotes.paymentSchedule.sumMustBe100', { sum: sumError.sum }));
    }
    return out;
  }
}
