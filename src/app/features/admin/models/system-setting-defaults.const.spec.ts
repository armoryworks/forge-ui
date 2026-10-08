import { SYSTEM_SETTING_DEFAULTS } from './system-setting-defaults.const';

describe('SYSTEM_SETTING_DEFAULTS', () => {
  it('starts new jobs at Normal priority, matching the server', () => {
    expect(SYSTEM_SETTING_DEFAULTS['jobs.default_priority']).toBe('Normal');
  });

  it('holds brand colour defaults in #rrggbb form', () => {
    expect(SYSTEM_SETTING_DEFAULTS['theme.primary_color']).toMatch(/^#[0-9a-f]{6}$/);
    expect(SYSTEM_SETTING_DEFAULTS['theme.accent_color']).toMatch(/^#[0-9a-f]{6}$/);
  });
});
