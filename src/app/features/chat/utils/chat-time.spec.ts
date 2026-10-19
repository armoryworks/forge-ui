import { describe, expect, it } from 'vitest';

import { chatDateSeparator, formatChatTime } from './chat-time';

const NOW = new Date(2026, 9, 19, 12, 0);
const t = (key: string) => `[${key}]`;
const at = (day: number, hour = 9) => ({ createdAt: new Date(2026, 9, day, hour, 5) });

describe('formatChatTime', () => {
  it('uses the short numeric hour, not a zero-padded one', () => {
    expect(formatChatTime(new Date(2026, 9, 19, 9, 5), 'en')).toMatch(/^9:05\s?AM$/);
  });

  it('follows the active language', () => {
    expect(formatChatTime(new Date(2026, 9, 19, 15, 5), 'es')).toBe('15:05');
  });
});

describe('chatDateSeparator', () => {
  it('shows nothing above the first message of today', () => {
    expect(chatDateSeparator([at(19)], 0, 'en', t, NOW)).toBeNull();
  });

  it('labels the switch to today with the translated key', () => {
    expect(chatDateSeparator([at(17), at(19)], 1, 'en', t, NOW)).toBe('[chat.today]');
  });

  it('labels yesterday with the translated key', () => {
    expect(chatDateSeparator([at(18)], 0, 'en', t, NOW)).toBe('[chat.yesterday]');
  });

  it('shows nothing between two messages on the same day', () => {
    expect(chatDateSeparator([at(17, 9), at(17, 10)], 1, 'en', t, NOW)).toBeNull();
  });

  it('formats older days as a localised date', () => {
    expect(chatDateSeparator([at(15)], 0, 'en', t, NOW)).toContain('Oct');
  });

  it('returns null for an index outside the list', () => {
    expect(chatDateSeparator([at(15)], 3, 'en', t, NOW)).toBeNull();
  });
});
