import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  inject,
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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslateService } from '@ngx-translate/core';

import { LanguageService } from '../../services/language.service';
import { formatLocaleNumber, parseLocaleNumber } from '../../utils/locale-number';

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
 */
@Component({
  selector: 'app-currency-input',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule],
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
export class CurrencyInputComponent implements ControlValueAccessor, Validator, AfterViewInit {
  private readonly translate = inject(TranslateService, { optional: true });
  private readonly language = this.translate ? inject(LanguageService) : null;

  readonly label = input.required<string>();
  readonly placeholder = input<string>('0.00');
  readonly currencySymbol = input<string>('$');
  readonly min = input<number | string | null>(0);
  readonly max = input<number | string | null>(null);
  readonly step = input<number | string>('0.01');
  readonly required = input<boolean>(false);
  /** Read-only mode — see styles.scss .app-readonly-field treatment. */
  readonly isReadonly = input<boolean>(false);

  protected readonly disabled = signal(false);

  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  private text = '';
  private invalidNumber = false;

  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  protected get inputMode(): string {
    const min = this.min();
    return min !== null && min !== '' && Number(min) >= 0 ? 'decimal' : 'text';
  }

  ngAfterViewInit(): void {
    this.setText(this.text);
  }

  writeValue(value: number | string | null): void {
    this.invalidNumber = false;
    if (value === null || value === undefined || value === '') {
      this.setText('');
      return;
    }
    const num = typeof value === 'number' ? value : Number(value);
    this.setText(Number.isFinite(num) ? formatLocaleNumber(num, this.lang()) : '');
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
    if (!this.invalidNumber) return null;
    const fallback = `${this.label()} must be a number`;
    const text = this.translate?.instant('shared.numberFormat', { label: this.label() });
    return { numberFormat: { message: typeof text === 'string' && text !== 'shared.numberFormat' ? text : fallback } };
  }

  protected onInput(event: Event): void {
    this.text = (event.target as HTMLInputElement).value;
    const parsed = parseLocaleNumber(this.text, this.lang());
    this.invalidNumber = parsed !== null && Number.isNaN(parsed);
    this.onChange(this.invalidNumber ? null : parsed);
  }

  protected onBlur(): void {
    const parsed = parseLocaleNumber(this.text, this.lang());
    if (parsed !== null && !Number.isNaN(parsed)) this.setText(formatLocaleNumber(parsed, this.lang()));
    this.onTouched();
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
