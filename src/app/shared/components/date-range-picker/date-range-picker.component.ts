import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { formatDate, toDateOnly } from '../../utils/date.utils';
import { provideStrictDateAdapter } from '../../utils/strict-date-adapter';

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

const PRESET_KEYS: Record<string, string> = {
  'Today': 'dateRange.presets.today',
  'This Week': 'dateRange.presets.thisWeek',
  'This Month': 'dateRange.presets.thisMonth',
  'Last 30 Days': 'dateRange.presets.last30Days',
};

export interface DateRangePreset {
  label: string;
  range: DateRange;
}

@Component({
  selector: 'app-date-range-picker',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatDatepickerModule, TranslatePipe],
  templateUrl: './date-range-picker.component.html',
  styleUrl: './date-range-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateRangePickerComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => DateRangePickerComponent),
      multi: true,
    },
    provideStrictDateAdapter(),
  ],
})
export class DateRangePickerComponent implements ControlValueAccessor, Validator {
  private readonly translate = inject(TranslateService, { optional: true });

  readonly label = input<string>('Date Range');
  readonly presets = input<string[]>([]);
  readonly min = input<Date | null>(null);
  readonly max = input<Date | null>(null);

  protected readonly startDate = signal<Date | null>(null);
  protected readonly endDate = signal<Date | null>(null);
  protected readonly disabled = signal(false);
  protected readonly startUnparsed = signal(false);
  protected readonly endUnparsed = signal(false);

  protected readonly errorMessage = computed(() => {
    const errors = this.rangeErrors(this.startDate(), this.endDate(), this.startUnparsed(), this.endUnparsed());
    return errors ? (Object.values(errors)[0] as { message: string }).message : null;
  });

  private onChange: (value: DateRange) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: DateRange | null): void {
    this.startDate.set(value?.start ?? null);
    this.endDate.set(value?.end ?? null);
    this.startUnparsed.set(false);
    this.endUnparsed.set(false);
  }

  /** Fails while either typed date is not a real calendar day, falls outside [min]/[max], or when From falls after To. */
  validate(_control: AbstractControl): ValidationErrors | null {
    return this.rangeErrors(this.startDate(), this.endDate(), this.startUnparsed(), this.endUnparsed());
  }

  registerOnChange(fn: (value: DateRange) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected onStartChange(event: MatDatepickerInputEvent<Date>): void {
    const unparsed = this.isUnparsed(event);
    this.startUnparsed.set(unparsed);
    if (!unparsed) this.startDate.set(event.value);
    this.emitChange();
  }

  protected onEndChange(event: MatDatepickerInputEvent<Date>): void {
    const unparsed = this.isUnparsed(event);
    this.endUnparsed.set(unparsed);
    if (!unparsed) this.endDate.set(event.value);
    this.emitChange();
  }

  protected markTouched(): void {
    this.onTouched();
  }

  protected applyPreset(presetLabel: string): void {
    const range = resolveDateRangePreset(presetLabel);
    this.startDate.set(range.start);
    this.endDate.set(range.end);
    this.startUnparsed.set(false);
    this.endUnparsed.set(false);
    this.emitChange();
  }

  private isUnparsed(event: MatDatepickerInputEvent<Date>): boolean {
    const text = (event.targetElement as HTMLInputElement | undefined)?.value ?? '';
    return event.value === null && text.trim() !== '';
  }

  private rangeErrors(start: Date | null, end: Date | null, startUnparsed: boolean, endUnparsed: boolean): ValidationErrors | null {
    if (startUnparsed || endUnparsed) {
      const field = this.t(startUnparsed ? 'common.from' : 'common.to');
      return { dateRangeParse: { message: this.t('validation.invalidDate', { field }) } };
    }
    const min = toDateOnly(this.min());
    const max = toDateOnly(this.max());
    for (const [date, key] of [[start, 'common.from'], [end, 'common.to']] as const) {
      const day = toDateOnly(date);
      if (day && min && day < min) {
        return { dateRangeMin: { message: this.t('validation.dateMin', { field: this.t(key), min: formatDate(this.min()) }) } };
      }
      if (day && max && day > max) {
        return { dateRangeMax: { message: this.t('validation.dateMax', { field: this.t(key), max: formatDate(this.max()) }) } };
      }
    }
    if (start && end && start.getTime() > end.getTime()) {
      return {
        dateRangeOrder: {
          message: this.t('validation.dateRangeOrder', { start: this.t('common.from'), end: this.t('common.to') }),
        },
      };
    }
    return null;
  }

  private t(key: string, params?: Record<string, string>): string {
    return this.translate?.instant(key, params) ?? key;
  }

  protected presetKey(preset: string): string {
    return PRESET_KEYS[preset] ?? preset;
  }

  private emitChange(): void {
    this.onChange({ start: this.startDate(), end: this.endDate() });
  }
}

export function resolveDateRangePreset(label: string): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (label) {
    case 'Today':
      return { start: today, end: today };
    case 'This Week': {
      const day = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start: monday, end: sunday };
    }
    case 'This Month':
      return {
        start: new Date(today.getFullYear(), today.getMonth(), 1),
        end: new Date(today.getFullYear(), today.getMonth() + 1, 0),
      };
    case 'Last 30 Days': {
      const start = new Date(today);
      start.setDate(today.getDate() - 29);
      return { start, end: today };
    }
    default:
      return { start: null, end: null };
  }
}
