import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  forwardRef,
  inject,
  Injectable,
  input,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter, MAT_DATE_FORMATS, NativeDateAdapter } from '@angular/material/core';

import { formatDate, toCalendarDate } from '../../utils/date.utils';
import { LanguageService } from '../../services/language.service';

const NUMERIC_DATE_INPUT: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };

/** Custom date formats enforcing MM/dd/yyyy display (project standard) */
const QBE_DATE_FORMATS = {
  parse: { dateInput: 'MM/dd/yyyy' },
  display: {
    dateInput: NUMERIC_DATE_INPUT,
    monthYearLabel: { year: 'numeric', month: 'short' } as Intl.DateTimeFormatOptions,
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' } as Intl.DateTimeFormatOptions,
    monthYearA11yLabel: { year: 'numeric', month: 'long' } as Intl.DateTimeFormatOptions,
  },
};

/**
 * Native adapter whose month and weekday names follow the UI language while the typed
 * date stays MM/dd/yyyy in every language, so parsing does not change with the language.
 */
@Injectable()
export class LocalizedNativeDateAdapter extends NativeDateAdapter {
  override format(date: Date, displayFormat: object): string {
    if (displayFormat === NUMERIC_DATE_INPUT) {
      if (!this.isValid(date)) throw Error('NativeDateAdapter: Cannot format invalid date.');
      return formatDate(date);
    }
    return super.format(date, displayFormat);
  }
}

@Component({
  selector: 'app-datepicker',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatDatepickerModule],
  templateUrl: './datepicker.component.html',
  styleUrl: './datepicker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatepickerComponent),
      multi: true,
    },
    { provide: MAT_DATE_FORMATS, useValue: QBE_DATE_FORMATS },
    { provide: DateAdapter, useClass: LocalizedNativeDateAdapter },
  ],
})
export class DatepickerComponent implements ControlValueAccessor {
  private readonly destroyRef = inject(DestroyRef);
  private readonly dateAdapter = inject(DateAdapter);
  private readonly language = inject(LanguageService);

  readonly label = input.required<string>();
  readonly min = input<Date | null>(null);
  readonly max = input<Date | null>(null);
  readonly required = input<boolean>(false);
  /** Read-only mode — see styles.scss .app-readonly-field treatment.
   *  The calendar toggle button is hidden via the global rule. */
  readonly isReadonly = input<boolean>(false);

  /**
   * Internal FormControl that the matInput binds to via [formControl].
   * Material's matDatepicker requires Angular Forms integration on the
   * input it's attached to — a plain [value] binding is NOT sufficient
   * (the picker's overlay opens but mat-calendar can't bind to a value
   * source, so it never renders). The CVA hooks below sync this
   * internal control with whatever the parent's FormControl/NgModel is
   * driving.
   */
  protected readonly internalControl = new FormControl<Date | null>(null);

  private onChange: (value: Date | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    effect(() => this.dateAdapter.setLocale(this.language.intlLocale()));
    // Forward internal-control changes out to the parent CVA. Skipping
    // emitEvent in writeValue prevents a feedback loop.
    this.internalControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.onChange(value));
  }

  writeValue(value: Date | string | null): void {
    this.internalControl.setValue(value ? new Date(toCalendarDate(value).getTime()) : null, { emitEvent: false });
  }

  registerOnChange(fn: (value: Date | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    if (disabled) this.internalControl.disable({ emitEvent: false });
    else this.internalControl.enable({ emitEvent: false });
  }

  protected markTouched(): void {
    this.onTouched();
  }
}
