import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  forwardRef,
  inject,
  Injector,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  ControlValueAccessor,
  FormControl,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { ErrorStateMatcher } from '@angular/material/core';
import { TranslateService } from '@ngx-translate/core';

import { BoundControl } from '../../utils/bound-control';
import { formatDate, toCalendarDate } from '../../utils/date.utils';
import { provideStrictDateAdapter } from '../../utils/strict-date-adapter';

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
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => DatepickerComponent),
      multi: true,
    },
    // Standalone components don't inherit NgModule providers, so
    // MatNativeDateModule's DateAdapter binding never reached
    // matDatepicker — clicks threw NG0201 NullInjectorError. The
    // `provideNativeDateAdapter()` helper is the standalone-friendly
    // form and registers DateAdapter + MAT_DATE_LOCALE locally.
    provideStrictDateAdapter(),
  ],
})
export class DatepickerComponent implements ControlValueAccessor, Validator, AfterContentInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService, { optional: true });
  private readonly injector = inject(Injector);
  private readonly bound = new BoundControl();

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

  protected readonly isRequired = computed(() => this.required() || this.bound.isRequired());

  protected readonly errorMessage = signal<string | null>(null);

  protected readonly errorStateMatcher: ErrorStateMatcher = {
    isErrorState: (control) => this.errorMessage() !== null || !!(control?.hasError('required') && control.touched),
  };

  private onChange: (value: Date | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    // Forward internal-control changes out to the parent CVA. Skipping
    // emitEvent in writeValue prevents a feedback loop.
    this.internalControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.onChange(value));
    this.internalControl.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshErrorMessage());
  }

  writeValue(value: Date | string | null): void {
    this.internalControl.setValue(value ? new Date(toCalendarDate(value).getTime()) : null, { emitEvent: false });
    this.internalControl.markAsPristine();
    this.internalControl.markAsUntouched();
    this.refreshErrorMessage();
  }

  /**
   * Surfaces the inner datepicker's errors on the parent control. A typed date that is not a real
   * calendar day always fails; min/max only fail once the user has changed the value, so a stored
   * date that predates a later [min] does not block saving an untouched record.
   */
  validate(_control: AbstractControl): ValidationErrors | null {
    const errors = this.internalControl.errors;
    if (!errors) return null;
    if (errors['matDatepickerParse']) {
      return { matDatepickerParse: { message: this.t('validation.invalidDate', { field: this.label() }) } };
    }
    if (!this.internalControl.dirty) return null;
    if (errors['matDatepickerMin']) {
      const min = formatDate(errors['matDatepickerMin'].min as Date);
      return { matDatepickerMin: { message: this.t('validation.dateMin', { field: this.label(), min }) } };
    }
    if (errors['matDatepickerMax']) {
      const max = formatDate(errors['matDatepickerMax'].max as Date);
      return { matDatepickerMax: { message: this.t('validation.dateMax', { field: this.label(), max }) } };
    }
    return null;
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

  ngAfterContentInit(): void {
    this.bound.attach(this.injector, this.destroyRef);
  }

  protected markTouched(): void {
    this.internalControl.markAsTouched();
    this.onTouched();
    this.refreshErrorMessage();
  }

  private refreshErrorMessage(): void {
    const errors = this.internalControl.touched ? this.validate(this.internalControl) : null;
    const first = errors ? (Object.values(errors)[0] as { message: string }) : null;
    this.errorMessage.set(first?.message ?? null);
  }

  private t(key: string, params: Record<string, string>): string {
    return this.translate?.instant(key, params) ?? key;
  }
}
