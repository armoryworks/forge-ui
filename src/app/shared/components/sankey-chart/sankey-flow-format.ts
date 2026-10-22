export function formatSankeyFlow(flow: number, unit: string | null | undefined, currencyCode: string, locale: string): string {
  if (unit === 'currency') {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(flow);
  }
  const value = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(flow);
  return unit && unit !== 'count' ? `${value} ${unit}` : value;
}
