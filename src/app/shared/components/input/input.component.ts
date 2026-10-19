import {
  AfterContentInit,
  AfterViewInit,
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
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  ControlValueAccessor,
  FormGroupDirective,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  NgControl,
  NgForm,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput, MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EMPTY, merge } from 'rxjs';

import { FormValidationService } from '../../services/form-validation.service';
import { LanguageService } from '../../services/language.service';
import { decimalPlaces, formatLocaleNumber, parseLocaleNumber } from '../../utils/locale-number';

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatTooltipModule, TranslatePipe],
  templateUrl: './input.component.html',
  styleUrl: './input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
})
export class InputComponent implements ControlValueAccessor, Validator, AfterContentInit, AfterViewInit {
  private readonly injector = inject(Injector);
  private readonly translate = inject(TranslateService, { optional: true });
  private readonly language = this.translate ? inject(LanguageService) : null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly parentForm = inject(FormGroupDirective, { optional: true }) ?? inject(NgForm, { optional: true });

  readonly label = input.required<string>();
  readonly type = input<'text' | 'number' | 'email' | 'password' | 'time' | 'datetime-local'>('text');
  readonly info = input<string>('');
  readonly placeholder = input<string>('');
  readonly prefix = input<string>('');
  readonly suffix = input<string>('');
  readonly isReadonly = input<boolean>(false);
  readonly maxlength = input<number | null>(null);
  readonly autocomplete = input<string>('off');
  readonly mask = input<'phone' | 'zip' | 'ssn' | 'ein' | 'date' | 'currency' | null>(null);
  readonly required = input<boolean>(false);
  // Phase 3 / WU-10 — number-input precision controls. Optional; only used when
  // type === 'number'. PO/SO line quantity + price use step="0.0001" for
  // 4-decimal precision parity with the server-side decimal(18,4) schema.
  readonly step = input<string | number | null>(null);
  readonly min = input<string | number | null>(null);
  readonly max = input<string | number | null>(null);

  protected readonly disabled = signal(false);
  protected readonly showPassword = signal(false);

  private readonly control = signal<AbstractControl | null>(null);
  private readonly controlState = signal(0);

  protected readonly errorMessage = computed(() => {
    this.controlState();
    const control = this.control();
    if (!control?.invalid || !control.errors) return null;
    if (!control.touched && !this.parentForm?.submitted) return null;
    for (const [key, value] of Object.entries(control.errors)) {
      const message = FormValidationService.messageFor(key, value, this.label());
      if (message !== null) return message;
    }
    return null;
  });

  protected readonly errorStateMatcher: ErrorStateMatcher = {
    isErrorState: () => this.errorMessage() !== null,
  };

  private readonly matInput = viewChild(MatInput);
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  private text = '';
  private edited = false;
  private invalidNumber = false;

  constructor() {
    effect(() => {
      this.errorMessage();
      this.matInput()?.updateErrorState();
    });
    let validatorInputsRead = false;
    effect(() => {
      this.type();
      this.mask();
      if (validatorInputsRead) untracked(() => this.onValidatorChange());
      validatorInputsRead = true;
    });
  }

  protected get isNumeric(): boolean {
    return this.type() === 'number' || this.mask() === 'currency';
  }

  protected get inputMode(): string | null {
    if (!this.isNumeric) return null;
    const min = this.toNumber(this.min());
    return this.mask() === 'currency' || (min !== null && min >= 0) ? 'decimal' : 'text';
  }

  protected get effectiveMaxlength(): number | null {
    const mask = this.mask();
    return this.maxlength() ?? (mask === 'phone' ? 50 : mask === 'zip' ? 20 : null);
  }

  protected get effectiveType(): string {
    if (this.isNumeric) return 'text';
    if (this.type() === 'password') return this.showPassword() ? 'text' : 'password';
    return this.type();
  }

  ngAfterContentInit(): void {
    const control = this.injector.get(NgControl, null, { self: true, optional: true })?.control ?? null;
    if (!control) return;
    this.control.set(control);
    merge<unknown[]>(control.events, this.parentForm?.ngSubmit ?? EMPTY)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.controlState.update(v => v + 1));
  }

  ngAfterViewInit(): void {
    this.setText(this.text);
  }

  protected toggleShowPassword(): void {
    this.showPassword.update(v => !v);
  }

  private onChange: (value: string | number | null) => void = () => {};
  private onTouched: () => void = () => {};
  private onValidatorChange: () => void = () => {};

  writeValue(value: string | number | null): void {
    this.edited = false;
    if (this.isNumeric) {
      this.invalidNumber = false;
      if (value === null || value === undefined || value === '') {
        this.setText('');
        return;
      }
      const num = typeof value === 'number' ? value : Number(value);
      this.setText(Number.isFinite(num) ? this.formatNumber(num) : String(value));
      return;
    }
    this.setText(this.formatStored(String(value ?? '')));
  }

  registerOnChange(fn: (value: string | number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  validate(control: AbstractControl): ValidationErrors | null {
    if (!this.isNumeric) return null;
    if (this.invalidNumber) {
      return { numberFormat: { message: this.message('shared.numberFormat', `${this.label()} must be a number`) } };
    }
    const value = control.value;
    if (this.mask() === 'currency' && typeof value === 'number' && decimalPlaces(value) > 2) {
      return {
        decimalPlaces: {
          message: this.message('shared.numberDecimals', `${this.label()} allows at most 2 decimal places`, { places: 2 }),
        },
      };
    }
    return null;
  }

  protected onInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    this.text = el.value;
    this.edited = true;

    if (this.isNumeric) {
      const parsed = parseLocaleNumber(this.text, this.lang());
      this.invalidNumber = parsed !== null && Number.isNaN(parsed);
      this.onChange(this.invalidNumber ? null : parsed);
      return;
    }

    const typingMask = this.typingMask();
    if (typingMask) {
      this.text = typingMask(this.text);
      el.value = this.text;
    }
    this.onChange(this.text);
  }

  protected onBlur(): void {
    if (this.isNumeric) {
      const parsed = parseLocaleNumber(this.text, this.lang());
      if (parsed !== null && !Number.isNaN(parsed)) this.setText(this.formatNumber(parsed));
    } else if (this.edited && (this.mask() === 'phone' || this.mask() === 'zip')) {
      const formatted = this.mask() === 'phone' ? this.formatPhone(this.text, true) : this.formatZip(this.text, true);
      if (formatted !== this.text) {
        this.setText(formatted);
        this.onChange(formatted);
      }
    }
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

  private message(key: string, fallback: string, params: Record<string, unknown> = {}): string {
    if (!this.translate) return fallback;
    const text = this.translate.instant(key, { label: this.label(), ...params });
    return typeof text === 'string' && text !== key ? text : fallback;
  }

  private formatNumber(value: number): string {
    return formatLocaleNumber(value, this.lang(), this.mask() === 'currency');
  }

  private toNumber(value: string | number | null): number | null {
    if (value === null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  private typingMask(): ((raw: string) => string) | null {
    switch (this.mask()) {
      case 'ssn': return raw => this.formatSsn(raw);
      case 'ein': return raw => this.formatEin(raw);
      case 'date': return raw => this.formatDate(raw);
      default: return null;
    }
  }

  private formatStored(raw: string): string {
    switch (this.mask()) {
      case 'phone': return this.formatPhone(raw, false);
      case 'zip': return this.formatZip(raw, false);
      default: return this.typingMask()?.(raw) ?? raw;
    }
  }

  private formatPhone(raw: string, sanitize: boolean): string {
    const ext = /\s*(?:ext\.?|extension|x|#)\s*(\d+)\s*$/i.exec(raw);
    const main = ext ? raw.slice(0, ext.index) : raw;
    const suffix = ext ? ` x${ext[1]}` : '';
    const digits = main.replace(/\D/g, '');
    const national = digits.length === 11 && digits.startsWith('1')
      ? digits.slice(1)
      : digits.length === 10 && !main.trim().startsWith('+') ? digits : null;
    if (national) {
      const country = digits.length === 11 ? '+1 ' : '';
      return `${country}(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}${suffix}`;
    }
    if (!sanitize) return raw;
    return `${main.replace(/[^0-9+()\-. ]/g, '').replace(/\s+/g, ' ').trim()}${suffix}`;
  }

  private formatZip(raw: string, sanitize: boolean): string {
    if (/^[\d\s-]*$/.test(raw)) {
      const digits = raw.replace(/\D/g, '');
      if (digits.length === 5) return digits;
      if (digits.length === 9) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    if (!sanitize) return raw;
    return raw.toUpperCase().replace(/[^A-Z0-9 -]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  }

  private formatSsn(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 9);
    if (digits.length === 0) return '';
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }

  // EIN format: XX-XXXXXXX (2 digits, dash, 7 digits — 9 total).
  private formatEin(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 9);
    if (digits.length === 0) return '';
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }

  private formatDate(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    if (digits.length === 0) return '';
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }
}
