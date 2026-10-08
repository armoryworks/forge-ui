import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  forwardRef,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  ControlValueAccessor,
  FormGroupDirective,
  NG_VALUE_ACCESSOR,
  NgControl,
  NgForm,
} from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput, MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EMPTY, merge } from 'rxjs';

import { FormValidationService } from '../../services/form-validation.service';

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatTooltipModule],
  templateUrl: './input.component.html',
  styleUrl: './input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
})
export class InputComponent implements ControlValueAccessor, AfterContentInit {
  private readonly injector = inject(Injector);
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

  protected readonly value = signal<string | number>('');
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

  constructor() {
    effect(() => {
      this.errorMessage();
      this.matInput()?.updateErrorState();
    });
  }

  protected get effectiveType(): string {
    if (this.mask() === 'currency') return 'text';
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

  protected toggleShowPassword(): void {
    this.showPassword.update(v => !v);
  }

  private onChange: (value: string | number) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | number | null): void {
    if (this.mask() === 'currency') {
      this.value.set(value != null && value !== '' ? this.formatCurrency(String(value)) : '');
      return;
    }
    const masked = this.applyMask(String(value ?? ''));
    this.value.set(masked);
  }

  registerOnChange(fn: (value: string | number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected onInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    let val = el.value;

    if (this.mask() === 'currency') {
      const formatted = this.formatCurrency(val);
      el.value = formatted;
      this.value.set(formatted);
      const numeric = this.parseCurrencyValue(formatted);
      this.onChange(numeric);
      return;
    }

    if (this.mask()) {
      val = this.applyMask(val);
      el.value = val;
    }

    const emitValue = this.type() === 'number' ? +val : val;
    this.value.set(emitValue);
    this.onChange(emitValue);
  }

  protected markTouched(): void {
    this.onTouched();
  }

  private applyMask(raw: string): string {
    switch (this.mask()) {
      case 'phone': return this.formatPhone(raw);
      case 'zip': return this.formatZip(raw);
      case 'ssn': return this.formatSsn(raw);
      case 'ein': return this.formatEin(raw);
      case 'date': return this.formatDate(raw);
      case 'currency': return this.formatCurrency(raw);
      default: return raw;
    }
  }

  private formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    if (digits.length === 0) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  private formatZip(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 9);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
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

  private formatCurrency(raw: string): string {
    // Strip everything except digits and decimal point
    let cleaned = raw.replace(/[^0-9.]/g, '');
    if (!cleaned) return '';

    // Only allow one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }

    // Limit to 2 decimal places
    const [whole, decimal] = cleaned.split('.');
    const formattedWhole = whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';

    if (decimal !== undefined) {
      return `${formattedWhole}.${decimal.slice(0, 2)}`;
    }
    return formattedWhole;
  }

  private parseCurrencyValue(formatted: string): number {
    const cleaned = formatted.replace(/,/g, '');
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
  }
}
