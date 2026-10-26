function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Party total less the legacy control balance, rounded to the cent (0 = ties). Null until the control is entered. */
export function tieOutDifference(partyTotal: number, controlTotal: number | null): number | null {
  return controlTotal === null ? null : round2(partyTotal - controlTotal);
}
