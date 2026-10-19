export function formatSankeyFlow(flow: number, unit: string | null | undefined, currencyCode: string): string {
  if (unit === 'currency') {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(flow);
  }
  const value = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(flow);
  return unit && unit !== 'count' ? `${value} ${unit}` : value;
}
