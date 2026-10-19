import { Chart } from 'chart.js';
import { color } from 'chart.js/helpers';

export function cssVar(name: string, fallback = ''): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function translucent(value: string, alpha: number): string {
  const parsed = color(value);
  return parsed.valid ? parsed.alpha(alpha).rgbString() : value;
}

export function applyChartDefaults(): void {
  Chart.defaults.color = cssVar('--text-secondary', '#64748b');
  Chart.defaults.borderColor = cssVar('--border', '#d1d5db');
  const sankey = Chart.defaults.datasets['sankey' as keyof typeof Chart.defaults.datasets] as { color?: string } | undefined;
  if (sankey) sankey.color = cssVar('--text', '#1e293b');
}

export function refreshCharts(): void {
  applyChartDefaults();
  Object.values(Chart.instances).forEach(chart => chart.update('none'));
}

let observer: MutationObserver | null = null;

export function watchChartTheme(): void {
  applyChartDefaults();
  if (observer || typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
  observer = new MutationObserver(() => refreshCharts());
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
}
