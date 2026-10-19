import { HttpErrorResponse } from '@angular/common/http';

import { FormControl, FormGroup } from '@angular/forms';

import { hasServerValidationDetail, resolveFormControl } from './server-validation.utils';

describe('hasServerValidationDetail', () => {
  it('is true for a 400 whose body carries a detail', () => {
    const err = new HttpErrorResponse({ status: 400, error: { title: 'Validation failed', detail: 'Part number is already in use.' } });
    expect(hasServerValidationDetail(err)).toBe(true);
  });

  it('is false for a 400 with an empty or missing detail', () => {
    expect(hasServerValidationDetail(new HttpErrorResponse({ status: 400, error: { detail: '' } }))).toBe(false);
    expect(hasServerValidationDetail(new HttpErrorResponse({ status: 400, error: { title: 'Validation failed' } }))).toBe(false);
    expect(hasServerValidationDetail(new HttpErrorResponse({ status: 400, error: null }))).toBe(false);
  });

  it('is false for other statuses and non-HTTP errors', () => {
    expect(hasServerValidationDetail(new HttpErrorResponse({ status: 500, error: { detail: 'boom' } }))).toBe(false);
    expect(hasServerValidationDetail(new Error('boom'))).toBe(false);
    expect(hasServerValidationDetail(null)).toBe(false);
  });
});

describe('resolveFormControl', () => {
  const form = new FormGroup({ title: new FormControl(''), description: new FormControl('') });

  it('maps a wrapped server field to the flat control by its last segment', () => {
    expect(resolveFormControl(form, 'data.title')).toBe(form.controls.title);
    expect(resolveFormControl(form, 'request.Description')).toBe(form.controls.description);
  });

  it('returns null when no segment matches', () => {
    expect(resolveFormControl(form, 'data.unknown')).toBeNull();
    expect(resolveFormControl(form, 'lines[0]')).toBeNull();
  });
});
