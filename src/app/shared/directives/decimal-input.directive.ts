import { Directive, ElementRef, forwardRef, HostListener, inject } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';

import { LanguageService } from '../services/language.service';
import { formatLocaleNumber, parseLocaleNumber } from '../utils/locale-number';

/**
 * Turns a raw `<input>` into a decimal text field for compact layouts (table cells) where
 * `app-input` does not fit. Typed text is parsed with the app language's separators, so an es
 * user's `1,5` is 1.5; blank text emits null, and partial or malformed text emits null with a
 * `numberFormat` error. The field text is rewritten only on write and on blur, never while typing.
 */
@Directive({
  selector: 'input[appDecimalInput]',
  standalone: true,
  host: {
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
  },
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DecimalInputDirective), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => DecimalInputDirective), multi: true },
  ],
})
export class DecimalInputDirective implements ControlValueAccessor, Validator {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly language = inject(TranslateService, { optional: true }) ? inject(LanguageService) : null;

  private invalidNumber = false;
  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: number | null): void {
    this.invalidNumber = false;
    this.el.nativeElement.value = typeof value === 'number' && Number.isFinite(value)
      ? formatLocaleNumber(value, this.lang())
      : '';
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.el.nativeElement.disabled = disabled;
  }

  validate(_control: AbstractControl): ValidationErrors | null {
    return this.invalidNumber ? { numberFormat: true } : null;
  }

  @HostListener('input')
  protected onInput(): void {
    const parsed = parseLocaleNumber(this.el.nativeElement.value, this.lang());
    this.invalidNumber = parsed !== null && Number.isNaN(parsed);
    this.onChange(this.invalidNumber ? null : parsed);
  }

  @HostListener('blur')
  protected onBlur(): void {
    const parsed = parseLocaleNumber(this.el.nativeElement.value, this.lang());
    if (parsed !== null && !Number.isNaN(parsed)) this.el.nativeElement.value = formatLocaleNumber(parsed, this.lang());
    this.onTouched();
  }

  private lang(): string {
    return this.language?.currentLanguage() ?? 'en';
  }
}
