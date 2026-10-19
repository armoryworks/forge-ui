import { FormControl, FormGroup, Validators } from '@angular/forms';

import { controlIsRequired } from './control-is-required';
import { onOrAfter } from './on-or-after.validator';
import { requiredTrimmed } from './required-trimmed.validator';
import { wholeNumber } from './whole-number.validator';

describe('requiredTrimmed', () => {
  it('treats empty, null and whitespace-only values as missing', () => {
    for (const value of [null, undefined, '', '   ', '\t\n', []]) {
      expect(requiredTrimmed(new FormControl(value))).toEqual({ required: true });
    }
  });

  it('accepts text with visible characters and non-string values', () => {
    expect(requiredTrimmed(new FormControl('  a  '))).toBeNull();
    expect(requiredTrimmed(new FormControl(0))).toBeNull();
    expect(requiredTrimmed(new FormControl(false))).toBeNull();
  });
});

describe('wholeNumber', () => {
  it('rejects fractions and passes integers and empty values', () => {
    expect(wholeNumber(new FormControl(1.5))).toEqual({ wholeNumber: true });
    expect(wholeNumber(new FormControl('2.5'))).toEqual({ wholeNumber: true });
    expect(wholeNumber(new FormControl(3))).toBeNull();
    expect(wholeNumber(new FormControl(null))).toBeNull();
    expect(wholeNumber(new FormControl(''))).toBeNull();
  });
});

describe('onOrAfter', () => {
  const build = (start: unknown, end: unknown) => new FormGroup({
    start: new FormControl(start),
    end: new FormControl(end, onOrAfter('start', 'End must be on or after start')),
  });

  it('fails when the end is before the start', () => {
    const form = build(new Date(2026, 9, 10), new Date(2026, 9, 9));
    form.controls.end.updateValueAndValidity();
    expect(form.controls.end.errors).toEqual({ onOrAfter: { message: 'End must be on or after start' } });
  });

  it('passes for the same day, a later day, or a missing value', () => {
    const same = build(new Date(2026, 9, 10, 8), new Date(2026, 9, 10, 7));
    same.controls.end.updateValueAndValidity();
    expect(same.controls.end.errors).toBeNull();
    const missing = build(null, new Date(2026, 9, 1));
    missing.controls.end.updateValueAndValidity();
    expect(missing.controls.end.errors).toBeNull();
  });
});

describe('controlIsRequired', () => {
  it('detects either required validator', () => {
    expect(controlIsRequired(new FormControl('', Validators.required))).toBe(true);
    expect(controlIsRequired(new FormControl('', [requiredTrimmed, Validators.maxLength(5)]))).toBe(true);
    expect(controlIsRequired(new FormControl(''))).toBe(false);
    expect(controlIsRequired(null)).toBe(false);
  });
});
