import { describe, it, expect } from 'vitest';

import { hireDatePayload } from './hire-date-payload';

describe('hireDatePayload', () => {
  it('sends the hire date on create as a UTC date', () => {
    expect(hireDatePayload(new Date(2026, 9, 26), true, false)).toBe('2026-10-26T00:00:00Z');
  });

  it('leaves the start date alone on an edit that did not touch it', () => {
    expect(hireDatePayload(new Date(2026, 9, 26), false, false)).toBeUndefined();
  });

  it('sends a changed hire date on edit and nothing when it was cleared', () => {
    expect(hireDatePayload(new Date(2019, 8, 16), false, true)).toBe('2019-09-16T00:00:00Z');
    expect(hireDatePayload(null, false, true)).toBeUndefined();
  });
});
