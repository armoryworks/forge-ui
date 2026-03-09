import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export interface DateRangePreset {
  label: string;
  range: DateRange;
}

@Component({
  selector: 'app-date-range-picker',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatDatepickerModule, MatNativeDateModule],
  templateUrl: './date-range-picker.component.html',
  styleUrl: './date-range-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateRangePickerComponent),
      multi: true,
    },
  ],
})
export class DateRangePickerComponent implements ControlValueAccessor {
  readonly label = input<string>('Date Range');
  readonly presets = input<string[]>([]);
  readonly min = input<Date | null>(null);
  readonly max = input<Date | null>(null);

  protected readonly startDate = signal<Date | null>(null);
  protected readonly endDate = signal<Date | null>(null);
  protected readonly disabled = signal(false);

  private onChange: (value: DateRange) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: DateRange | null): void {
    this.startDate.set(value?.start ?? null);
    this.endDate.set(value?.end ?? null);
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

  protected onStartChange(date: Date | null): void {
    this.startDate.set(date);
    this.emitChange();
  }

  protected onEndChange(date: Date | null): void {
    this.endDate.set(date);
    this.emitChange();
  }

  protected markTouched(): void {
    this.onTouched();
  }

  protected applyPreset(presetLabel: string): void {
    const range = this.resolvePreset(presetLabel);
    this.startDate.set(range.start);
    this.endDate.set(range.end);
    this.emitChange();
  }

  private emitChange(): void {
    this.onChange({ start: this.startDate(), end: this.endDate() });
  }

  private resolvePreset(label: string): DateRange {
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
}
