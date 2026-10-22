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
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { BoundControl } from '../../utils/bound-control';

export interface SelectOption {
  value: unknown;
  label: string;
}

@Component({
  selector: 'app-select',
  standalone: true,
  imports: [MatFormFieldModule, MatSelectModule],
  templateUrl: './select.component.html',
  styleUrl: './select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
})
export class SelectComponent implements ControlValueAccessor, AfterContentInit {
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly bound = new BoundControl();

  readonly label = input.required<string>();
  readonly options = input.required<SelectOption[]>();
  readonly multiple = input(false);
  readonly placeholder = input('');
  readonly required = input(false);
  /** Read-only mode — see styles.scss .app-readonly-field treatment.
   *  mat-select doesn't have a readonly attribute, so we set disabled
   *  internally; the global readonly rule strips the disabled tint
   *  and arrow so it visually reads as data, not a disabled control. */
  readonly isReadonly = input<boolean>(false);
  readonly selectionChange = output<unknown>();

  protected readonly value = signal<unknown>(null);
  protected readonly disabled = signal(false);
  protected readonly isRequired = computed(() => this.required() || this.bound.isRequired());

  ngAfterContentInit(): void {
    this.bound.attach(this.injector, this.destroyRef);
  }

  private onChange: (value: unknown) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: unknown): void {
    this.value.set(value);
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected onSelectionChange(value: unknown): void {
    this.value.set(value);
    this.onChange(value);
    this.selectionChange.emit(value);
  }

  protected markTouched(): void {
    this.onTouched();
  }
}
