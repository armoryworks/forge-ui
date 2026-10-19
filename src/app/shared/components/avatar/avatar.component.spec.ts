import { describe, it, expect } from 'vitest';

import { avatarInk } from './avatar.component';

describe('avatarInk', () => {
  it('uses dark ink on the light slate default', () => {
    expect(avatarInk('#94a3b8')).toBe('#0f172a');
  });

  it('uses dark ink on the teal default, where white is below 4.5:1', () => {
    expect(avatarInk('#0d9488')).toBe('#0f172a');
  });

  it('keeps white ink on the darker palette colours', () => {
    expect(avatarInk('#64748b')).toBe('#ffffff');
    expect(avatarInk('#7c3aed')).toBe('#ffffff');
    expect(avatarInk('#15803d')).toBe('#ffffff');
    expect(avatarInk('#1e293b')).toBe('#ffffff');
  });

  it('handles short hex', () => {
    expect(avatarInk('#fff')).toBe('#0f172a');
    expect(avatarInk('#000')).toBe('#ffffff');
  });

  it('falls back to white ink for colours it cannot parse', () => {
    expect(avatarInk('var(--mat-sys-primary)')).toBe('#ffffff');
    expect(avatarInk('rgb(10, 20, 30)')).toBe('#ffffff');
    expect(avatarInk('')).toBe('#ffffff');
  });
});
