import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  forwardRef,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule, FormControl } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { debounceTime, distinctUntilChanged, filter, switchMap, catchError, of } from 'rxjs';

@Component({
  selector: 'app-entity-picker',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatAutocompleteModule],
  templateUrl: './entity-picker.component.html',
  styleUrl: './entity-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EntityPickerComponent),
      multi: true,
    },
  ],
})
export class EntityPickerComponent implements ControlValueAccessor, OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  readonly label = input.required<string>();
  readonly entityType = input.required<string>();
  readonly displayField = input<string>('name');
  readonly filters = input<Record<string, string>>({});
  readonly placeholder = input<string>('');

  protected readonly searchControl = new FormControl('');
  protected readonly results = signal<Record<string, unknown>[]>([]);
  protected readonly disabled = signal(false);
  private selectedValue: unknown = null;

  private onChange: (value: unknown) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit(): void {
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(term => typeof term === 'string' && term.length >= 2),
      switchMap(term => this.search(term as string)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(results => this.results.set(results));
  }

  writeValue(value: unknown): void {
    this.selectedValue = value;
    // If we have a value, we'd need to resolve display text from the API
    // For now, clear the search when value is set programmatically to null
    if (value == null) {
      this.searchControl.setValue('', { emitEvent: false });
    }
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
    disabled ? this.searchControl.disable({ emitEvent: false }) : this.searchControl.enable({ emitEvent: false });
  }

  protected onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    const entity = event.option.value as Record<string, unknown>;
    this.selectedValue = entity['id'];
    this.searchControl.setValue(String(entity[this.displayField()] ?? ''), { emitEvent: false });
    this.onChange(this.selectedValue);
  }

  protected onInput(): void {
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

  protected getDisplayText(entity: Record<string, unknown>): string {
    return String(entity[this.displayField()] ?? '');
  }

  private search(term: string) {
    let params = new HttpParams().set('search', term).set('pageSize', '10');
    const extraFilters = this.filters();
    for (const [key, val] of Object.entries(extraFilters)) {
      params = params.set(key, val);
    }

    return this.http
      .get<Record<string, unknown>[] | { data: Record<string, unknown>[] }>(`/api/v1/${this.entityType()}`, { params })
      .pipe(
        catchError(() => of([])),
        switchMap(res => of(Array.isArray(res) ? res : (res.data ?? []))),
      );
  }
}
