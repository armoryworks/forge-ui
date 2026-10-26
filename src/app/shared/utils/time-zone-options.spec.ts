import { describe, expect, it } from 'vitest';

import { timeZoneOptions } from './time-zone-options';

describe('timeZoneOptions', () => {
  it('lists IANA zones sorted, with UTC and readable labels', () => {
    const options = timeZoneOptions();
    const values = options.map((o) => o.value as string);
    expect(values).toContain('UTC');
    expect(values).toContain('America/New_York');
    expect([...values].sort()).toEqual(values);
    expect(options.find((o) => o.value === 'America/New_York')?.label).toBe('America/New York');
  });

  it('keeps a saved zone selectable even when the browser does not list it', () => {
    expect(timeZoneOptions('Etc/GMT+5').map((o) => o.value)).toContain('Etc/GMT+5');
  });
});
