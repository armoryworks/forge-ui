import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule, FormControl } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';

export interface AutocompleteOption {
  [key: string]: unknown;
}

@Component({
  selector: 'app-autocomplete',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatAutocompleteModule],
  templateUrl: './autocomplete.component.html',
  styleUrl: './autocomplete.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AutocompleteComponent),
      multi: true,
    },
  ],
})
export class AutocompleteComponent implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly options = input.required<AutocompleteOption[]>();
  readonly displayField = input<string>('label');
  readonly valueField = input<string>('value');
  readonly placeholder = input<string>('');
  readonly minChars = input<number>(1);

  protected readonly searchControl = new FormControl('');
  protected readonly disabled = signal(false);
  private selectedValue: unknown = null;

  private readonly searchValue = toSignal(
    this.searchControl.valueChanges.pipe(startWith('')),
    { initialValue: '' },
  );

  protected readonly filteredOptions = computed(() => {
    const all = this.options();
    const search = this.searchValue() ?? '';
    const display = this.displayField();
    const min = this.minChars();

    if (search.length < min) return [];

    const lower = search.toLowerCase();
    return all.filter(opt => {
      const text = String(opt[display] ?? '');
      return text.toLowerCase().includes(lower);
    });
  });

  private onChange: (value: unknown) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: unknown): void {
    this.selectedValue = value;
    const match = this.options().find(o => o[this.valueField()] === value);
    this.searchControl.setValue(match ? String(match[this.displayField()] ?? '') : '', { emitEvent: false });
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
    if (disabled) {
      this.searchControl.disable({ emitEvent: false });
    } else {
      this.searchControl.enable({ emitEvent: false });
    }
  }

  protected onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    const opt = event.option.value as AutocompleteOption;
    this.selectedValue = opt[this.valueField()];
    this.searchControl.setValue(String(opt[this.displayField()] ?? ''), { emitEvent: false });
    this.onChange(this.selectedValue);
  }

  protected onInput(): void {
    // Clear value when user types (selection lost)
    if (this.selectedValue !== null) {
      this.selectedValue = null;
      this.onChange(null);
    }
  }

  protected markTouched(): void {
    this.onTouched();
  }

  protected displayFn = (): string => {
    return this.searchControl.value ?? '';
  };

  protected getOptionDisplay(opt: AutocompleteOption): string {
    return String(opt[this.displayField()] ?? '');
  }
}
