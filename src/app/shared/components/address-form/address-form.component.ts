import {
  ChangeDetectionStrategy, Component, forwardRef, inject, input, OnInit, signal,
} from '@angular/core';
import {
  ControlValueAccessor, FormControl, FormGroup, NG_VALUE_ACCESSOR,
  ReactiveFormsModule, Validators,
} from '@angular/forms';

import { TranslatePipe } from '@ngx-translate/core';

import { InputComponent } from '../input/input.component';
import { SelectComponent, SelectOption } from '../select/select.component';
import { AddressService } from '../../services/address.service';
import { Address } from '../../models/address.model';

const US_STATES: SelectOption[] = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY',
  'LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND',
  'OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
].map(s => ({ value: s, label: s }));

const COUNTRY_OPTIONS: SelectOption[] = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'MX', label: 'Mexico' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'CN', label: 'China' },
  { value: 'JP', label: 'Japan' },
  { value: 'OTHER', label: 'Other' },
];

@Component({
  selector: 'app-address-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, SelectComponent, TranslatePipe],
  templateUrl: './address-form.component.html',
  styleUrl: './address-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => AddressFormComponent),
    multi: true,
  }],
})
export class AddressFormComponent implements ControlValueAccessor, OnInit {
  private readonly addressService = inject(AddressService);

  /** Which fields are required. Defaults: line1, city, state, postalCode all required. */
  readonly requireLine1 = input(true);
  readonly requireLine2 = input(false);
  readonly requireCity = input(true);
  readonly requireState = input(true);
  readonly requirePostalCode = input(true);
  readonly requireCountry = input(false);

  /** Show line2 field */
  readonly showLine2 = input(true);

  /** Show verify button */
  readonly showVerify = input(true);

  /** Lock country to a fixed value (null = editable) */
  readonly fixedCountry = input<string | null>(null);

  /** Use state dropdown (US states) vs free-text input */
  readonly stateDropdown = input(true);

  /** Compact mode — fewer labels, tighter spacing */
  readonly compact = input(false);

  protected readonly stateOptions: SelectOption[] = [{ value: null, label: '-- Select --' }, ...US_STATES];
  protected readonly countryOptions: SelectOption[] = COUNTRY_OPTIONS;

  protected readonly verifying = signal(false);
  protected readonly verifyResult = signal<{ isValid: boolean; messages: string[] } | null>(null);
  protected readonly verified = signal(false);

  protected readonly form = new FormGroup({
    line1: new FormControl<string | null>(null),
    line2: new FormControl<string | null>(null),
    city: new FormControl<string | null>(null),
    state: new FormControl<string | null>(null),
    postalCode: new FormControl<string | null>(null),
    country: new FormControl<string | null>('US'),
  });

  private onChange: (value: Address | null) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit(): void {
    this.applyValidators();

    const fixed = this.fixedCountry();
    if (fixed) {
      this.form.controls.country.setValue(fixed);
      this.form.controls.country.disable();
    }

    this.form.valueChanges.subscribe(() => {
      this.verified.set(false);
      this.verifyResult.set(null);
      this.emitValue();
    });
  }

  writeValue(value: Address | null): void {
    if (value) {
      this.form.patchValue({
        line1: value.line1 ?? null,
        line2: value.line2 ?? null,
        city: value.city ?? null,
        state: value.state ?? null,
        postalCode: value.postalCode ?? null,
        country: value.country ?? 'US',
      }, { emitEvent: false });
    } else {
      this.form.reset({ country: this.fixedCountry() ?? 'US' }, { emitEvent: false });
    }
  }

  registerOnChange(fn: (value: Address | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
      if (this.fixedCountry()) {
        this.form.controls.country.disable({ emitEvent: false });
      }
    }
  }

  protected verify(): void {
    const val = this.form.getRawValue();
    if (!val.line1 || !val.city || !val.state || !val.postalCode) return;

    this.verifying.set(true);
    this.verifyResult.set(null);

    this.addressService.validate({
      line1: val.line1,
      line2: val.line2 ?? undefined,
      city: val.city,
      state: val.state,
      postalCode: val.postalCode,
      country: val.country ?? 'US',
    }).subscribe({
      next: (result) => {
        this.verifying.set(false);
        this.verified.set(result.isValid);
        this.verifyResult.set({ isValid: result.isValid, messages: result.messages });

        // If the API returned a corrected address, offer to apply it
        if (result.isValid && result.street) {
          this.form.patchValue({
            line1: result.street ?? val.line1,
            city: result.city ?? val.city,
            state: result.state ?? val.state,
            postalCode: result.zip ?? val.postalCode,
            country: result.country ?? val.country,
          });
          this.verified.set(true);
        }
      },
      error: () => {
        this.verifying.set(false);
        this.verifyResult.set({ isValid: false, messages: ['Address verification service unavailable'] });
      },
    });
  }

  private emitValue(): void {
    const val = this.form.getRawValue();
    const hasAnyValue = val.line1 || val.city || val.state || val.postalCode;

    this.onChange(hasAnyValue ? {
      line1: val.line1 ?? '',
      line2: val.line2 ?? undefined,
      city: val.city ?? '',
      state: val.state ?? '',
      postalCode: val.postalCode ?? '',
      country: val.country ?? 'US',
    } : null);

    this.onTouched();
  }

  private applyValidators(): void {
    const c = this.form.controls;
    if (this.requireLine1()) c.line1.addValidators(Validators.required);
    if (this.requireLine2()) c.line2.addValidators(Validators.required);
    if (this.requireCity()) c.city.addValidators(Validators.required);
    if (this.requireState()) c.state.addValidators(Validators.required);
    if (this.requirePostalCode()) c.postalCode.addValidators(Validators.required);
    if (this.requireCountry()) c.country.addValidators(Validators.required);

    c.line1.addValidators(Validators.maxLength(200));
    c.line2.addValidators(Validators.maxLength(200));
    c.city.addValidators(Validators.maxLength(100));
    c.state.addValidators(Validators.maxLength(50));
    c.postalCode.addValidators(Validators.maxLength(20));
    c.country.addValidators(Validators.maxLength(10));

    Object.values(c).forEach(ctrl => ctrl.updateValueAndValidity({ emitEvent: false }));
  }
}
