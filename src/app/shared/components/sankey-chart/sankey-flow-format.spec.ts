import { formatSankeyFlow } from './sankey-flow-format';

describe('formatSankeyFlow', () => {
  it('formats money flows as currency', () => {
    expect(formatSankeyFlow(1234.5, 'currency', 'USD')).toBe(
      new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(1234.5));
  });

  it('shows the unit of measure after a quantity', () => {
    expect(formatSankeyFlow(1125.5, 'kg', 'USD')).toBe(
      `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(1125.5)} kg`);
  });

  it('shows plain counts without a unit', () => {
    expect(formatSankeyFlow(6, 'count', 'USD')).toBe('6');
    expect(formatSankeyFlow(6, undefined, 'USD')).toBe('6');
  });
});
