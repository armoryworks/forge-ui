import { describe, it, expect } from 'vitest';

import { DurationMsPipe } from './duration-ms.pipe';

describe('DurationMsPipe', () => {
  const pipe = new DurationMsPipe();

  it.each([null, undefined, 0, -500])('returns an empty string for %s', value => {
    expect(pipe.transform(value)).toBe('');
  });

  it('shows milliseconds only below one second', () => {
    expect(pipe.transform(250)).toBe('250ms');
    expect(pipe.transform(999)).toBe('999ms');
    expect(pipe.transform(1000)).toBe('1s');
  });

  it('shows a fractional seconds value the way it was typed', () => {
    expect(pipe.transform(8500)).toBe('8.5s');
    expect(pipe.transform(7500)).toBe('7.5s');
    expect(pipe.transform(59_900)).toBe('59.9s');
  });

  it('rounds the seconds to one decimal', () => {
    expect(pipe.transform(8540)).toBe('8.5s');
    expect(pipe.transform(8560)).toBe('8.6s');
    expect(pipe.transform(1001)).toBe('1s');
  });

  it('carries a remainder that rounds up to a full minute', () => {
    expect(pipe.transform(59_960)).toBe('1m');
    expect(pipe.transform(119_970)).toBe('2m');
  });

  it('combines hours, minutes and seconds', () => {
    expect(pipe.transform(72_000)).toBe('1m 12s');
    expect(pipe.transform(90_000)).toBe('1m 30s');
    expect(pipe.transform(3_600_000)).toBe('1h');
    expect(pipe.transform(5_400_500)).toBe('1h 30m 0.5s');
    expect(pipe.transform(3_612_300)).toBe('1h 12.3s');
  });
});
