import { describe, expect, it } from 'vitest';

import { localizeServerError, serverErrorKey, serverFieldLabel } from './server-error-localizer';

const catalog: Record<string, string> = {
  'apiErrors.validators.required': '{{field}} es obligatorio.',
  'apiErrors.validators.between': '{{field}} debe estar entre {{from}} y {{to}}.',
  'apiErrors.codes.effectiveRangeOrder': 'La fecha de fin de vigencia debe ser posterior a la de inicio.',
  'apiErrors.codes.invalidDate': '{{field}} no es una fecha válida.',
  'columns.unitPrice': 'Precio unitario',
};

const translate = (key: string, params?: Record<string, unknown>): string =>
  (catalog[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params?.[name] ?? ''));

describe('serverErrorKey', () => {
  it('maps explicit API codes and FluentValidation validator names to catalog keys', () => {
    expect(serverErrorKey('effective-range-order')).toBe('apiErrors.codes.effectiveRangeOrder');
    expect(serverErrorKey('NotEmptyValidator')).toBe('apiErrors.validators.required');
    expect(serverErrorKey('invalid-date')).toBe('apiErrors.codes.invalidDate');
  });

  it('leaves predicate rules and missing codes unmapped', () => {
    expect(serverErrorKey('PredicateValidator')).toBeUndefined();
    expect(serverErrorKey(null)).toBeUndefined();
  });
});

describe('serverFieldLabel', () => {
  it('uses a catalog label for the leaf of a field path, else humanizes it', () => {
    expect(serverFieldLabel('lines[0].unitPrice', translate)).toBe('Precio unitario');
    expect(serverFieldLabel('data.EffectiveTo', translate)).toBe('Effective to');
  });
});

describe('localizeServerError', () => {
  it('words a coded error with its rule limits and field label', () => {
    expect(localizeServerError(
      { field: 'lines[0].unitPrice', message: 'Unit price must be between 0 and 100.', code: 'InclusiveBetweenValidator', params: { from: 0, to: 100 } },
      translate,
    )).toBe('Precio unitario debe estar entre 0 y 100.');
    expect(localizeServerError(
      { field: 'data.effectiveTo', message: 'Effective To must be after Effective From', code: 'effective-range-order' },
      translate,
    )).toBe('La fecha de fin de vigencia debe ser posterior a la de inicio.');
  });

  it('keeps the server message for uncoded errors and codes without a catalog entry', () => {
    expect(localizeServerError({ field: 'x', message: 'Server text' }, translate)).toBe('Server text');
    expect(localizeServerError({ field: 'x', message: 'Server text', code: 'PredicateValidator' }, translate)).toBe('Server text');
    expect(localizeServerError({ field: 'x', message: 'Server text', code: 'EmailValidator' }, translate)).toBe('Server text');
  });
});
