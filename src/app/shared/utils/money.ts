/** Decimal places of an amount of money (numeric(18,2) on the server). */
export const MONEY_DECIMALS = 2;

/** Decimal places of a unit price, unit cost or quantity (numeric(18,4) on the server). */
export const UNIT_DECIMALS = 4;

/**
 * Rounds an amount to the cent, half away from zero — the server's Money.Round. The scaled value is
 * trimmed to 12 significant digits first so binary artefacts such as 1.005 × 100 = 100.49999999999999
 * still round up.
 */
export function roundMoney(value: number): number {
  const cents = Math.round(Number((Math.abs(value) * 100).toPrecision(12)));
  return cents === 0 ? 0 : Math.sign(value) * cents / 100;
}

/** Number of digits after the decimal point in a number's shortest representation. */
export function decimalPlacesOf(value: number): number {
  const [mantissa, exponent] = String(value).toLowerCase().split('e');
  const fraction = mantissa.split('.')[1]?.length ?? 0;
  return Math.max(0, fraction - Number(exponent ?? 0));
}
