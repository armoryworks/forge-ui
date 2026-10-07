import { afterEach, describe, expect, it, vi } from 'vitest';

import { randomId } from './random-id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('randomId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses crypto.randomUUID when the context provides it', () => {
    const randomUUID = vi.fn(() => '11111111-2222-4333-8444-555555555555');
    vi.stubGlobal('crypto', { randomUUID, getRandomValues: vi.fn() });

    expect(randomId()).toBe('11111111-2222-4333-8444-555555555555');
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('builds a v4 UUID from getRandomValues when randomUUID is missing', () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(0xff);
      return bytes;
    });
    vi.stubGlobal('crypto', { randomUUID: undefined, getRandomValues });

    const id = randomId();

    expect(getRandomValues).toHaveBeenCalledOnce();
    expect(id).toMatch(UUID_V4);
    expect(id).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });

  it('falls back to Math.random when no crypto API is available', () => {
    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(randomId()).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('returns distinct v4 UUIDs on the fallback path', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { randomUUID: undefined, getRandomValues: real.getRandomValues.bind(real) });

    const ids = new Set(Array.from({ length: 50 }, () => randomId()));

    expect(ids.size).toBe(50);
    ids.forEach(id => expect(id).toMatch(UUID_V4));
  });
});
