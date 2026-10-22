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
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput, MatInputModule } from '@angular/material/input';

import { BoundControl } from '../../utils/bound-control';

@Component({
  selector: 'app-textarea',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule],
  templateUrl: './textarea.component.html',
  styleUrl: './textarea.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextareaComponent),
      multi: true,
    },
  ],
})
export class TextareaComponent implements ControlValueAccessor, AfterContentInit {
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly bound = new BoundControl();

  readonly label = input('');
  readonly rows = input(3);
  readonly maxlength = input<number | null>(null);
  readonly hint = input('');
  readonly placeholder = input('');
  readonly ariaLabel = input<string | null>(null);
  /** Read-only mode — see styles.scss .app-readonly-field for the
   *  visual treatment. Keeps the Material chrome dimensions identical
   *  to editable mode but strips the outlined border + interactive
   *  affordances so the field reads as data, not as a control. */
  readonly isReadonly = input<boolean>(false);
  readonly required = input<boolean>(false);

  protected readonly value = signal('');
  protected readonly disabled = signal(false);

  protected readonly isRequired = computed(() => this.required() || this.bound.isRequired());
  protected readonly errorMessage = computed(() => this.bound.errorMessage(this.label()));
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

  ngAfterContentInit(): void {
    this.bound.attach(this.injector, this.destroyRef);
  }

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected onInput(event: Event): void {
    const val = (event.target as HTMLTextAreaElement).value;
    this.value.set(val);
    this.onChange(val);
  }

  protected markTouched(): void {
    this.onTouched();
  }
}
