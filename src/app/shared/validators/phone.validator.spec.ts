import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import { phoneValidator } from './phone.validator';

function errors(value: string | null): unknown {
  return phoneValidator(new FormControl(value));
}

describe('phoneValidator', () => {
  it.each([
    '(801) 555-1234',
    '+1 (801) 555-1234',
    '(801) 555-1234 x204',
    '+49 711 123456',
    '+49 (0)711 1234-567',
    '+44 20 7946 0958',
    '+33 1.23.45.67.89',
    '0711 1234567',
    '+81 3-1234-5678 ext. 12',
  ])('accepts %s', value => {
    expect(errors(value)).toBeNull();
  });

  it.each([
    '8015551234',
    '801-555-1234',
    '1 801 555 1234',
    '+1 801 555 1234',
    '12345',
    '+1234567890123456',
    'call me',
    '+49 711 12345a',
  ])('rejects %s', value => {
    expect(errors(value)).toEqual({ pattern: expect.objectContaining({ actualValue: value }) });
  });

  it('lets an empty value through for required to judge', () => {
    expect(errors('')).toBeNull();
    expect(errors(null)).toBeNull();
  });
});
