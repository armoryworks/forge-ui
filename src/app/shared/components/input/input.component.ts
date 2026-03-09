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

  protected readonly value = signal<string | number>('');
  protected readonly disabled = signal(false);

  private onChange: (value: string | number) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | number | null): void {
    this.value.set(value ?? '');
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
    const val = (event.target as HTMLInputElement).value;
    const emitValue = this.type() === 'number' ? +val : val;
    this.value.set(emitValue);
    this.onChange(emitValue);
  }

  protected markTouched(): void {
    this.onTouched();
  }
}
