/**
 * Round a money amount to 2 decimal places, half away from zero — the rounding the API uses for
 * invoice amounts (Math.Round(x, 2, MidpointRounding.AwayFromZero)). Float noise is trimmed to
 * 15 significant digits first, so 3 × 33.335 (100.00499999999999 in binary) rounds to 100.01.
 */
export function roundMoney(value: number): number {
  const cents = Math.round(Number((Math.abs(value) * 100).toPrecision(15)));
  return (Math.sign(value) * cents) / 100 || 0;
}
