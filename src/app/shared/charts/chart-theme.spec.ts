import { afterEach, describe, expect, it } from 'vitest';
import { Chart } from 'chart.js';

import './base-chart.directive';
import { applyChartDefaults, cssVar, translucent } from './chart-theme';

describe('chart theme', () => {
  const root = document.documentElement;

  afterEach(() => {
    ['--text', '--text-secondary', '--border', '--primary'].forEach(name => root.style.removeProperty(name));
    root.removeAttribute('data-theme');
  });

  it('reads a design token from the document root', () => {
    root.style.setProperty('--primary', '#0f766e');

    expect(cssVar('--primary', '#000000')).toBe('#0f766e');
  });

  it('falls back when the token is not set', () => {
    expect(cssVar('--not-a-token', '#abcdef')).toBe('#abcdef');
  });

  it('turns a token colour into a translucent fill a canvas can paint', () => {
    expect(translucent('#0f766e', 0.12)).toBe('rgba(15, 118, 110, 0.12)');
  });

  it('points chart text, grid lines and sankey labels at the theme tokens', () => {
    root.style.setProperty('--text', '#f1f5f9');
    root.style.setProperty('--text-secondary', '#cbd5e1');
    root.style.setProperty('--border', '#334155');

    applyChartDefaults();

    expect(Chart.defaults.color).toBe('#cbd5e1');
    expect(Chart.defaults.borderColor).toBe('#334155');
    expect((Chart.defaults.datasets as unknown as Record<string, { color?: string }>)['sankey'].color).toBe('#f1f5f9');
  });

  it('reports whether the tokens changed since the last pass', () => {
    root.style.setProperty('--border', '#111111');
    applyChartDefaults();

    expect(applyChartDefaults()).toBe(false);
    root.style.setProperty('--border', '#222222');
    expect(applyChartDefaults()).toBe(true);
  });

  it('re-reads the tokens when the theme attribute changes', async () => {
    root.style.setProperty('--text-secondary', '#64748b');
    applyChartDefaults();
    root.style.setProperty('--text-secondary', '#cbd5e1');

    root.setAttribute('data-theme', 'dark');
    await Promise.resolve();

    expect(Chart.defaults.color).toBe('#cbd5e1');
  });
});
