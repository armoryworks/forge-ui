import { HttpErrorResponse } from '@angular/common/http';

import { FormArray, FormControl, FormGroup } from '@angular/forms';

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

  it('does not move an indexed line error onto a top-level control with the same name', () => {
    const order = new FormGroup({
      quantity: new FormControl(1),
      lines: new FormArray([new FormGroup({ partId: new FormControl(1) })]),
    });

    expect(resolveFormControl(order, 'lines[0].quantity')).toBeNull();
    expect(resolveFormControl(order, 'lines.0.quantity')).toBeNull();
  });

  it('still resolves an indexed path that exists', () => {
    const order = new FormGroup({
      quantity: new FormControl(1),
      lines: new FormArray([new FormGroup({ quantity: new FormControl(2) })]),
    });

    expect(resolveFormControl(order, 'lines[0].quantity')).toBe(order.controls.lines.at(0).controls.quantity);
  });

  it('leaves the error unmatched when more than one control has the last segment name', () => {
    const customer = new FormGroup({
      name: new FormControl(''),
      contact: new FormGroup({ name: new FormControl('') }),
    });

    expect(resolveFormControl(customer, 'data.name')).toBeNull();
  });

  it('does not guess a nested or line control from an unindexed wrapped name', () => {
    const order = new FormGroup({
      customerId: new FormControl(1),
      lines: new FormArray([new FormGroup({ quantity: new FormControl(2) })]),
    });

    expect(resolveFormControl(order, 'data.quantity')).toBeNull();
    expect(resolveFormControl(order, 'data.customerId')).toBe(order.controls.customerId);
  });
});
