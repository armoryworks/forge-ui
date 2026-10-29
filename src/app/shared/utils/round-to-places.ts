/**
 * Rounds a number to `places` decimal places, half away from zero. The scaled value is trimmed to
 * 12 significant digits first, as `roundMoney` does, so binary artefacts such as
 * 19.049999999999997 round to 19.05 rather than 19.0499.
 */
export function roundToPlaces(value: number, places: number): number {
  const factor = 10 ** places;
  const scaled = Math.round(Number((Math.abs(value) * factor).toPrecision(12)));
  return scaled === 0 ? 0 : Math.sign(value) * scaled / factor;
}
