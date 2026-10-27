import { parse } from 'papaparse';

import { CsvRecord } from '../models/csv-record.model';

/**
 * Parses CSV (or tab-separated) text with a header row. Headers are trimmed and lower-cased, fully blank
 * rows are dropped, and the first few parser errors are returned as `Row n: message`.
 */
export function parseCsvText(text: string): { records: CsvRecord[]; errors: string[] } {
  const result = parse<CsvRecord>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase(),
  });
  const errors = (result.errors ?? []).slice(0, 5).map(e => `Row ${(e.row ?? 0) + 1}: ${e.message}`);
  const records = (result.data ?? []).filter(r => Object.values(r).some(v => String(v ?? '').trim() !== ''));
  return { records, errors };
}

/** The first non-blank value among `keys` (header aliases), trimmed. */
export function pickCsv(record: CsvRecord, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = record[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return undefined;
}

/** A number from a CSV cell, ignoring currency signs and thousands separators; `null` when blank, `NaN` when unreadable. */
export function parseCsvNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const cleaned = value.trim().replace(/[$€£,\s]/g, '');
  const negative = /^\(.*\)$/.test(cleaned);
  const n = Number(negative ? cleaned.slice(1, -1) : cleaned);
  return Number.isFinite(n) ? (negative ? -n : n) : NaN;
}

/**
 * A date from a CSV cell in `YYYY-MM-DD` or `MM/DD/YYYY` form, as the API's UTC midnight ISO string;
 * `null` when blank, `undefined` when unreadable.
 */
export function parseCsvDate(value: string | undefined): string | null | undefined {
  if (value === undefined || value.trim() === '') return null;
  const v = value.trim();
  let y: number; let m: number; let d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(v);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3]; }
  else if (us) { y = +us[3]; m = +us[1]; d = +us[2]; }
  else return undefined;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return undefined;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00Z`;
}
