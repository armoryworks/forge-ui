import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';

import { DatepickerComponent } from './datepicker.component';

interface PickerApi {
  internalControl: FormControl<Date | null>;
  writeValue(value: Date | string | null): void;
}

describe('DatepickerComponent.writeValue west of UTC', () => {
  let originalTz: string | undefined;

  function create(): PickerApi {
    TestBed.resetTestingModule();
    TestBed.overrideComponent(DatepickerComponent, { set: { template: '', imports: [] } });
    return TestBed.createComponent(DatepickerComponent).componentInstance as unknown as PickerApi;
  }

  beforeEach(() => {
    originalTz = process.env['TZ'];
    process.env['TZ'] = 'America/Denver';
  });

  afterEach(() => {
    if (originalTz === undefined) delete process.env['TZ'];
    else process.env['TZ'] = originalTz;
  });

  it.each([
    ['a date-only string', '2026-11-20'],
    ['a UTC-midnight string', '2026-11-20T00:00:00Z'],
    ['a UTC-midnight Date', new Date('2026-11-20T00:00:00Z')],
  ])('shows the stored calendar day for %s', (_label, value) => {
    const picker = create();

    picker.writeValue(value);

    const shown = picker.internalControl.value!;
    expect([shown.getFullYear(), shown.getMonth(), shown.getDate()]).toEqual([2026, 10, 20]);
  });

  it('keeps a picked local date and does not share the parent instance', () => {
    const picker = create();
    const picked = new Date(2026, 10, 20);

    picker.writeValue(picked);

    expect(picker.internalControl.value!.getTime()).toBe(picked.getTime());
    expect(picker.internalControl.value).not.toBe(picked);
  });

  it('clears on null', () => {
    const picker = create();

    picker.writeValue(null);

    expect(picker.internalControl.value).toBeNull();
  });
});

describe('DatepickerComponent as a validator', () => {
  interface ValidatingPicker extends PickerApi {
    validate(control: unknown): Record<string, { message: string }> | null;
    registerOnChange(fn: (value: Date | null) => void): void;
    errorMessage(): string | null;
    markTouched(): void;
    errorStateMatcher: { isErrorState(control: FormControl | null, form: null): boolean };
  }

  function create(): ValidatingPicker {
    TestBed.resetTestingModule();
    TestBed.overrideComponent(DatepickerComponent, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(DatepickerComponent);
    fixture.componentRef.setInput('label', 'Date of Birth');
    return fixture.componentInstance as unknown as ValidatingPicker;
  }

  it('reports a typed date that is not a real day even before the field is dirty', () => {
    const picker = create();

    picker.internalControl.setErrors({ matDatepickerParse: { text: '02/30/2026' } });

    expect(picker.validate(null)).toEqual({
      matDatepickerParse: { message: 'validation.invalidDate' },
    });
  });

  it('does not fail a stored date that falls outside [min] until the user changes it', () => {
    const picker = create();
    picker.writeValue('2020-01-15');
    picker.internalControl.setErrors({ matDatepickerMin: { min: new Date(2026, 0, 1), actual: new Date(2020, 0, 15) } });

    expect(picker.validate(null)).toBeNull();

    picker.internalControl.markAsDirty();
    picker.internalControl.setErrors({ matDatepickerMin: { min: new Date(2026, 0, 1), actual: new Date(2020, 0, 15) } });

    expect(Object.keys(picker.validate(null)!)).toEqual(['matDatepickerMin']);
  });

  it('reports a typed date past [max] once dirty', () => {
    const picker = create();
    picker.internalControl.markAsDirty();
    picker.internalControl.setErrors({ matDatepickerMax: { max: new Date(2026, 9, 19), actual: new Date(2099, 11, 31) } });

    expect(Object.keys(picker.validate(null)!)).toEqual(['matDatepickerMax']);
  });

  it('re-validates the parent through the forwarded value, emitting once per user change', () => {
    const picker = create();
    const parent = new FormControl<Date | null>(null, (control) => picker.validate(control));
    picker.registerOnChange((value) => parent.setValue(value));
    const emitted = vi.fn();
    parent.valueChanges.subscribe(emitted);

    picker.internalControl.markAsDirty();
    picker.internalControl.setValue(new Date(2026, 9, 19));
    expect(emitted).toHaveBeenCalledTimes(1);
    expect(parent.valid).toBe(true);

    picker.internalControl.addValidators(() => ({ matDatepickerParse: { text: '02/30/2026' } }));
    picker.internalControl.setValue(null);
    expect(emitted).toHaveBeenCalledTimes(2);
    expect(parent.hasError('matDatepickerParse')).toBe(true);
  });

  it('re-validates the parent when a [min]/[max] change re-runs the inner validators', () => {
    const picker = create();
    const parent = new FormControl<Date | null>(null, (control) => picker.validate(control));
    picker.registerOnChange((value) => parent.setValue(value));

    picker.internalControl.markAsDirty();
    picker.internalControl.setValue(new Date(2026, 0, 15));
    expect(parent.valid).toBe(true);

    picker.internalControl.addValidators(() => ({ matDatepickerMin: { min: new Date(2026, 5, 1), actual: new Date(2026, 0, 15) } }));
    picker.internalControl.updateValueAndValidity();
    expect(parent.hasError('matDatepickerMin')).toBe(true);
  });

  it('shows the parse message under the field once touched, and clears it when the parent writes a value', () => {
    const picker = create();
    picker.internalControl.setErrors({ matDatepickerParse: { text: 'x' } });
    expect(picker.errorMessage()).toBeNull();

    picker.markTouched();
    expect(picker.errorMessage()).toBe('validation.invalidDate');

    picker.writeValue(new Date(2026, 9, 19));
    expect(picker.errorMessage()).toBeNull();
  });

  it('keeps the error outline on an empty required field once touched, as the default matcher did', () => {
    const picker = create();
    const inner = new FormControl<Date | null>(null, Validators.required);

    expect(picker.errorStateMatcher.isErrorState(inner, null)).toBe(false);

    inner.markAsTouched();
    expect(picker.errorStateMatcher.isErrorState(inner, null)).toBe(true);

    inner.setValue(new Date(2026, 9, 19));
    expect(picker.errorStateMatcher.isErrorState(inner, null)).toBe(false);
  });
});
