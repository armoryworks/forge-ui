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
import { MatTooltipModule } from '@angular/material/tooltip';

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
export class InputComponent implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly type = input<'text' | 'number' | 'email' | 'password'>('text');
  readonly info = input<string>('');
  readonly placeholder = input<string>('');
  readonly prefix = input<string>('');
  readonly suffix = input<string>('');
  readonly isReadonly = input<boolean>(false);
  readonly maxlength = input<number | null>(null);
  readonly autocomplete = input<string>('off');
  readonly mask = input<'phone' | 'zip' | null>(null);
  readonly required = input<boolean>(false);

  protected readonly value = signal<string | number>('');
  protected readonly disabled = signal(false);

  private onChange: (value: string | number) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | number | null): void {
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
}
