import {
  AfterContentInit,
  AfterViewInit,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput, MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateService } from '@ngx-translate/core';

import { LanguageService } from '../../services/language.service';
import { BoundControl } from '../../utils/bound-control';
import { CalcErrorCode, CalcResult, evaluateCalcExpression } from '../../utils/calc-expression';
import { decimalPlaces, formatLocaleNumber, parseLocaleNumber } from '../../utils/locale-number';
import { MONEY_DECIMALS } from '../../utils/money';
import { roundToPlaces } from '../../utils/round-to-places';

/**
 * Shared currency input wrapper.
 *
 * Built specifically to fix the recurring `<mat-icon matPrefix>$` overlap with
 * Material's floating outline label (the bug that produced `$lanual cost
 * override` and `$ew Price` in screenshots — see
 * `phase-4-output/ux-research/parts-system-ux-analysis.md` §3.D and the
 * upstream Angular components issues #15027 / #26558).
 *
 * Visual approach: use Material's `matTextPrefix` slot. Unlike `matPrefix`
 * (which positions an icon inside the label-collision zone), `matTextPrefix`
 * is laid out before the input text in the same baseline as the value, so
 * the floating label slides up cleanly above it without overlap. No absolute
 * positioning, no manual offsets — Material handles it.
 *
 * `ControlValueAccessor` so it drops in as `formControlName="..."` like
 * `<app-input>`. Internally the input is `type="text"` with
 * `inputmode="decimal"` so mobile keyboards offer a numeric keypad (`text` when
 * `min` allows negatives, since the iOS decimal pad has no minus key); typed text
 * is parsed with the app language's decimal and group separators, and the
 * field text is only rewritten by `writeValue` and on blur, never while typing.
 * Blank, partial or malformed text emits null and raises a `numberFormat` error.
 *
 * `calc` makes it the money twin of `<app-input type="calc-number">`: the field takes simple
 * math (`120+35.50`, `1200/3`), emits the result rounded to the `step` decimals, replaces the
 * text with it on blur or Enter, and raises a `calcExpression` error for malformed math.
 */
@Component({
  selector: 'app-currency-input',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatTooltipModule],
  templateUrl: './currency-input.component.html',
  styleUrl: './currency-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CurrencyInputComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => CurrencyInputComponent),
      multi: true,
    },
  ],
})
export class CurrencyInputComponent implements ControlValueAccessor, Validator, AfterContentInit, AfterViewInit {
  private readonly translate = inject(TranslateService, { optional: true });
  private readonly language = this.translate ? inject(LanguageService) : null;
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly bound = new BoundControl();

  readonly label = input.required<string>();
  readonly placeholder = input<string>('0.00');
  readonly currencySymbol = input<string>('$');
  readonly min = input<number | string | null>(0);
  readonly max = input<number | string | null>(null);
  readonly step = input<number | string>('0.01');
  readonly required = input<boolean>(false);
  /** Read-only mode — see styles.scss .app-readonly-field treatment. */
  readonly isReadonly = input<boolean>(false);
  /** Accept simple math and fractions, as `<app-input type="calc-number">` does. */
  readonly calc = input(false, { transform: booleanAttribute });

  protected readonly disabled = signal(false);
  protected readonly showCalcHint = computed(() => this.calc() && !this.isReadonly() && !this.disabled());
  protected readonly calcHint = computed(() =>
    this.showCalcHint() ? this.message('shared.calcHint', 'Type a number or simple math: 360+64, 3/4, 1 3/16') : null);

  protected readonly isRequired = computed(() => this.required() || this.bound.isRequired());
  protected readonly errorMessage = computed(() => this.bound.errorMessage(this.label()));
  protected readonly errorStateMatcher: ErrorStateMatcher = {
    isErrorState: () => this.errorMessage() !== null,
  };

  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  private readonly matInput = viewChild(MatInput);
  private text = '';
  private invalidNumber = false;
  private calcError: CalcErrorCode | null = null;

  constructor() {
    effect(() => {
      this.errorMessage();
      this.matInput()?.updateErrorState();
    });
  }

  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  protected get inputMode(): string {
    if (this.calc()) return 'text';
    const min = this.min();
    return min !== null && min !== '' && Number(min) >= 0 ? 'decimal' : 'text';
  }

  ngAfterContentInit(): void {
    this.bound.attach(this.injector, this.destroyRef);
  }

  ngAfterViewInit(): void {
    this.setText(this.text);
  }

  writeValue(value: number | string | null): void {
    this.invalidNumber = false;
    this.calcError = null;
    if (value === null || value === undefined || value === '') {
      this.setText('');
      return;
    }
    const num = typeof value === 'number' ? value : Number(value);
    this.setText(Number.isFinite(num) ? formatLocaleNumber(num, this.lang(), false, MONEY_DECIMALS) : '');
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  validate(): ValidationErrors | null {
    if (this.calcError === 'divideByZero') {
      return { calcExpression: { message: this.message('shared.calcDivideByZero', `${this.label()} divides by zero`) } };
    }
    if (this.calcError !== null) {
      return {
        calcExpression: {
          message: this.message('shared.calcInvalid', `${this.label()} must be a number or simple math such as 3/4`),
        },
      };
    }
    if (!this.invalidNumber) return null;
    return { numberFormat: { message: this.message('shared.numberFormat', `${this.label()} must be a number`) } };
  }

  protected onInput(event: Event): void {
    this.text = (event.target as HTMLInputElement).value;
    if (this.calc()) {
      const result = this.resolveCalc(this.text);
      this.calcError = result.error;
      this.onChange(result.value);
      return;
    }
    const parsed = parseLocaleNumber(this.text, this.lang());
    this.invalidNumber = parsed !== null && Number.isNaN(parsed);
    this.onChange(this.invalidNumber ? null : parsed);
  }

  protected onEnter(): void {
    if (this.calc()) this.commitCalc();
  }

  protected onBlur(): void {
    if (this.calc()) {
      this.commitCalc();
    } else {
      const parsed = parseLocaleNumber(this.text, this.lang());
      if (parsed !== null && !Number.isNaN(parsed)) this.setText(formatLocaleNumber(parsed, this.lang(), false, MONEY_DECIMALS));
    }
    this.onTouched();
  }

  private commitCalc(): void {
    const result = this.resolveCalc(this.text);
    this.calcError = result.error;
    if (result.error !== null || result.value === null) return;
    this.setText(formatLocaleNumber(result.value, this.lang(), false, MONEY_DECIMALS));
  }

  private resolveCalc(text: string): CalcResult {
    const result = evaluateCalcExpression(text, this.lang());
    if (result.value === null) return result;
    const literal = parseLocaleNumber(text, this.lang());
    if (literal !== null && !Number.isNaN(literal)) return result;
    const step = Number(this.step());
    const places = Number.isFinite(step) && step > 0 ? decimalPlaces(String(this.step())) : MONEY_DECIMALS;
    return { value: roundToPlaces(result.value, places), error: null };
  }

  private message(key: string, fallback: string): string {
    const text = this.translate?.instant(key, { label: this.label() });
    return typeof text === 'string' && text !== key ? text : fallback;
  }

  private setText(text: string): void {
    this.text = text;
    const el = this.field()?.nativeElement;
    if (el && el.value !== text) el.value = text;
  }

  private lang(): string {
    return this.language?.currentLanguage() ?? 'en';
  }
}
