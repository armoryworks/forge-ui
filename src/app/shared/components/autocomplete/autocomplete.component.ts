import {
  AfterContentInit,
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
  AbstractControl,
  ControlValueAccessor,
  FormControl,
  FormGroupDirective,
  NG_VALUE_ACCESSOR,
  NgControl,
  NgForm,
  ReactiveFormsModule,
} from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { EMPTY, merge, startWith } from 'rxjs';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput, MatInputModule } from '@angular/material/input';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
  MatAutocompleteTrigger,
} from '@angular/material/autocomplete';

import { FormValidationService } from '../../services/form-validation.service';

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
export class AutocompleteComponent implements ControlValueAccessor, AfterContentInit {
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly parentForm = inject(FormGroupDirective, { optional: true }) ?? inject(NgForm, { optional: true });
  private readonly defaultErrorState = inject(ErrorStateMatcher);

  readonly label = input.required<string>();
  readonly options = input.required<AutocompleteOption[]>();
  readonly displayField = input<string>('label');
  readonly valueField = input<string>('value');
  readonly placeholder = input<string>('');
  readonly minChars = input<number>(1);
  readonly required = input<boolean>(false);
  readonly autoSelectFields = input<readonly string[]>([]);

  protected readonly searchControl = new FormControl('');
  protected readonly disabled = signal(false);
  private selectedValue: unknown = null;

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
    isErrorState: (searchControl, form) =>
      this.errorMessage() !== null || this.defaultErrorState.isErrorState(searchControl, form),
  };

  private readonly matInput = viewChild(MatInput);
  private readonly trigger = viewChild.required(MatAutocompleteTrigger);
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');

  private readonly searchValue = toSignal(
    this.searchControl.valueChanges.pipe(startWith('')),
    { initialValue: '' },
  );

  protected readonly filteredOptions = computed(() => {
    const all = this.options();
    // On selection, mat-autocomplete writes the chosen option OBJECT (the
    // <mat-option [value]="opt">) into the bound control, so this stream can
    // carry a non-string. Coerce anything non-string to an empty query so the
    // filter never calls .toLowerCase() on it — the recurring t.toLowerCase
    // TypeError that otherwise throws every change-detection cycle and breaks
    // the dropdown for the next selection.
    const raw = this.searchValue();
    const search = typeof raw === 'string' ? raw : '';
    const display = this.displayField();
    const min = this.minChars();

    if (search.length < min) return [];

    const lower = search.toLowerCase();
    return all.filter(opt => {
      const text = String(opt[display] ?? '');
      return text.toLowerCase().includes(lower);
    });
  });

  constructor() {
    effect(() => {
      this.errorMessage();
      this.matInput()?.updateErrorState();
    });
  }

  ngAfterContentInit(): void {
    const control = this.injector.get(NgControl, null, { self: true, optional: true })?.control ?? null;
    if (!control) return;
    this.control.set(control);
    merge<unknown[]>(control.events, this.parentForm?.ngSubmit ?? EMPTY)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.controlState.update(v => v + 1));
  }

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
    this.select(event.option.value as AutocompleteOption);
  }

  protected onInput(): void {
    // Clear value when user types (selection lost)
    if (this.selectedValue !== null) {
      this.selectedValue = null;
      this.onChange(null);
    }
  }

  protected onBlur(): void {
    this.resolveTypedText(!this.trigger().panelOpen);
    this.onTouched();
  }

  protected onPanelClosed(): void {
    if (document.activeElement !== this.searchInput().nativeElement) this.resolveTypedText(true);
  }

  protected onEnter(): void {
    if (!this.trigger().activeOption) this.resolveTypedText(true);
  }

  private resolveTypedText(clearUnmatched: boolean): void {
    const fields = this.autoSelectFields();
    if (fields.length === 0 || this.selectedValue !== null) return;
    const raw = this.searchControl.value;
    const text = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (!text) return;
    const exact = this.options().find(opt =>
      fields.some(field => String(opt[field] ?? '').toLowerCase() === text));
    const filtered = this.filteredOptions();
    const match = exact ?? (filtered.length === 1 ? filtered[0] : undefined);
    if (match) {
      this.select(match);
    } else if (clearUnmatched) {
      this.searchControl.setValue('');
    }
  }

  private select(opt: AutocompleteOption): void {
    this.selectedValue = opt[this.valueField()];
    this.searchControl.setValue(String(opt[this.displayField()] ?? ''), { emitEvent: false });
    this.onChange(this.selectedValue);
  }

  protected displayFn = (): string => {
    return this.searchControl.value ?? '';
  };

  protected getOptionDisplay(opt: AutocompleteOption): string {
    return String(opt[this.displayField()] ?? '');
  }
}
