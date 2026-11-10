import type { SelectOption } from '../components/select/select.component';
import { roundToPlaces } from './round-to-places';

export type MeasureKind = 'length' | 'weight' | 'volume';

interface MeasureUnit {
  readonly unit: string;
  readonly factor: number;
  readonly displayPlaces: number;
}

/** Decimal places of a canonical measure (mm, g, mL) — numeric(18,4) on the server. */
export const CANONICAL_MEASURE_PLACES = 4;

const UNITS: Record<MeasureKind, readonly MeasureUnit[]> = {
  length: [
    { unit: 'mm', factor: 1, displayPlaces: 4 },
    { unit: 'cm', factor: 10, displayPlaces: 4 },
    { unit: 'm', factor: 1000, displayPlaces: 6 },
    { unit: 'in', factor: 25.4, displayPlaces: 5 },
    { unit: 'ft', factor: 304.8, displayPlaces: 5 },
  ],
  weight: [
    { unit: 'g', factor: 1, displayPlaces: 4 },
    { unit: 'kg', factor: 1000, displayPlaces: 6 },
    { unit: 'lb', factor: 453.59237, displayPlaces: 5 },
    { unit: 'oz', factor: 28.349523125, displayPlaces: 5 },
  ],
  volume: [
    { unit: 'mL', factor: 1, displayPlaces: 4 },
    { unit: 'L', factor: 1000, displayPlaces: 6 },
    { unit: 'gal', factor: 3785.411784, displayPlaces: 5 },
  ],
};

function unitFor(kind: MeasureKind, unit: string | null | undefined): MeasureUnit {
  return UNITS[kind].find(u => u.unit === unit) ?? UNITS[kind][0];
}

/**
 * The display unit to use for a stored unit code: the code itself when it is a known unit of
 * `kind`, otherwise the canonical unit (mm, g or mL).
 */
export function measureDisplayUnit(kind: MeasureKind, unit: string | null | undefined): string {
  return unitFor(kind, unit).unit;
}

/** Unit picker options for `kind`, canonical unit first. */
export function measureUnitOptions(kind: MeasureKind): SelectOption[] {
  return UNITS[kind].map(u => ({ value: u.unit, label: u.unit }));
}

/**
 * Converts a value typed in `unit` to the canonical unit (mm, g, mL), rounded to the
 * server's 4 decimal places so 0.75 in is stored as 19.05 mm, not 19.049999999999997.
 */
export function toCanonicalMeasure(kind: MeasureKind, value: number | null, unit: string | null | undefined): number | null {
  if (value === null) return null;
  return roundToPlaces(value * unitFor(kind, unit).factor, CANONICAL_MEASURE_PLACES);
}

/**
 * Converts a canonical value (mm, g, mL) to `unit` for display, rounded to that unit's
 * display precision (in, ft, lb, oz, gal 5 places; mm, g, mL, cm 4; m, kg, L 6) so a stored
 * 19.05 mm reads 0.75 in rather than 0.7499999999999999.
 */
export function fromCanonicalMeasure(kind: MeasureKind, value: number | null, unit: string | null | undefined): number | null {
  if (value === null) return null;
  const u = unitFor(kind, unit);
  return roundToPlaces(value / u.factor, u.displayPlaces);
}

/**
 * The canonical value to save for a field showing `value` in `unit`. While the field still shows
 * what `stored` reads as in that unit, `stored` itself is kept, so saving a measure nobody edited
 * never moves it (0.3969 mm reads 0.01563 in, which would otherwise save back as 0.397 mm).
 */
export function canonicalMeasureToSave(
  kind: MeasureKind, value: number | null, unit: string | null | undefined, stored: number | null | undefined,
): number | null {
  if (value !== null && stored != null && fromCanonicalMeasure(kind, stored, unit) === value) return stored;
  return toCanonicalMeasure(kind, value, unit);
}
