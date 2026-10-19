import { describe, expect, it } from 'vitest';
import { FormControl, FormGroup } from '@angular/forms';

import { dateOrderValidator } from './date-order.validator';

function group(start: Date | string | null, end: Date | string | null): FormGroup {
  return new FormGroup(
    { start: new FormControl(start), end: new FormControl(end) },
    { validators: [dateOrderValidator('start', 'end', () => 'From must be on or before To')] },
  );
}

describe('dateOrderValidator', () => {
  it('passes when either side is empty or the days are in order', () => {
    expect(group(null, new Date(2026, 0, 1)).errors).toBeNull();
    expect(group(new Date(2026, 0, 1), null).errors).toBeNull();
    expect(group(new Date(2026, 0, 1), new Date(2026, 0, 2)).errors).toBeNull();
  });

  it('compares calendar days, so a later time on the same day still passes', () => {
    expect(group(new Date(2026, 0, 1, 15, 30), new Date(2026, 0, 1)).errors).toBeNull();
  });

  it('fails with a message pointing at the end field when the end day is earlier', () => {
    expect(group(new Date(2026, 9, 19), new Date(2026, 8, 19)).errors).toEqual({
      dateRangeOrder: { message: 'From must be on or before To', field: 'end' },
    });
  });
});
