import { HttpErrorResponse } from '@angular/common/http';

import { hasServerValidationDetail } from './server-validation.utils';

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
