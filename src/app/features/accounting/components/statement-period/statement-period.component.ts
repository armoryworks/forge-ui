import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { parseDateOnly, toDateOnly } from '../../../../shared/utils/date.utils';
import {
  AS_OF_PRESETS,
  RANGE_PRESETS,
  StatementPeriod,
  StatementPeriodMode,
  AsOfPreset,
  RangePreset,
  asOfForPreset,
  presetForAsOf,
  presetForRange,
  rangeForPreset,
} from '../../utils/statement-period';

/**
 * Period picker for the financial statements: a preset (this month, year to date, …) plus the
 * dates it stands for. `range` mode edits a from/to window; `asOf` mode edits a single as-of date
 * (carried in `to`). The parent owns the window (URL) and passes back the window the report used.
 */
@Component({
  selector: 'app-statement-period',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DatepickerComponent, SelectComponent],
  templateUrl: './statement-period.component.html',
  styleUrl: './statement-period.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatementPeriodComponent {
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = input<StatementPeriodMode>('range');
  readonly from = input<string | null>(null);
  readonly to = input<string | null>(null);
  readonly periodChange = output<StatementPeriod>();

  protected readonly presetControl = new FormControl<string>('yearToDate', { nonNullable: true });
  protected readonly fromControl = new FormControl<Date | null>(null);
  protected readonly toControl = new FormControl<Date | null>(null);

  protected readonly presetOptions = computed<SelectOption[]>(() =>
    (this.mode() === 'asOf' ? AS_OF_PRESETS : RANGE_PRESETS).map((p) => ({
      value: p,
      label: this.translate.instant(`accounting.period.presets.${p}`),
    })),
  );

  constructor() {
    effect(() => {
      const from = this.from();
      const to = this.to();
      const today = new Date();
      const preset = this.mode() === 'asOf' ? presetForAsOf(to, today) : presetForRange({ from, to }, today);
      this.presetControl.setValue(preset, { emitEvent: false });
      this.fromControl.setValue(from ? parseDateOnly(from) : null, { emitEvent: false });
      this.toControl.setValue(to ? parseDateOnly(to) : null, { emitEvent: false });
    });

    this.presetControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((preset) => {
      const today = new Date();
      if (this.mode() === 'asOf') {
        const asOf = asOfForPreset(preset as AsOfPreset, today);
        if (asOf) this.periodChange.emit({ from: null, to: asOf });
        return;
      }
      const range = rangeForPreset(preset as RangePreset, today);
      if (range) this.periodChange.emit(range);
    });

    this.fromControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.emitDates());
    this.toControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.emitDates());
  }

  private emitDates(): void {
    const from = this.mode() === 'asOf' ? null : toDateOnly(this.fromControl.value);
    const to = toDateOnly(this.toControl.value);
    if (!to || (from && from > to)) return;
    this.periodChange.emit({ from, to });
  }
}
