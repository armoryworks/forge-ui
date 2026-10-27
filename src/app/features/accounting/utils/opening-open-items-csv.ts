import { parse } from 'papaparse';

import { OpeningOpenItem } from '../models/opening-open-item.model';

/** Header row of the opening receivables/payables CSV template, in the column order it is read. */
export const OPENING_OPEN_ITEMS_TEMPLATE_HEADER = [
  'partyType', 'party', 'documentNumber', 'documentDate', 'dueDate', 'amount', 'description',
] as const;

/** Example rows: a customer invoice and a vendor bill, ISO dates and invariant amounts. */
export const OPENING_OPEN_ITEMS_TEMPLATE_EXAMPLES = [
  ['Customer', 'CUST-0001', 'INV-1001', '2025-12-01', '2025-12-31', '1200.00', 'Open invoice'],
  ['Vendor', 'VEND-0001', 'V-77', '2025-12-10', '2026-01-09', '450.00', 'Open bill'],
] as const;

/** Parsed open-items CSV: the usable rows and the 1-based line numbers that could not be read. */
export interface ParsedOpeningOpenItemsCsv {
  rows: OpeningOpenItem[];
  badLineNumbers: number[];
}

function partyTypeOf(cell: string): OpeningOpenItem['partyType'] | null {
  const value = cell.trim().toLowerCase();
  if (['customer', 'ar', 'cliente'].includes(value)) return 'Customer';
  if (['vendor', 'ap', 'proveedor'].includes(value)) return 'Vendor';
  return null;
}

function dateOf(cell: string): string | null | undefined {
  const text = cell.trim();
  if (text === '') return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return text;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  return undefined;
}

function amountOf(cell: string): number | null {
  const text = cell.replace(/[$\s,]/g, '');
  const negative = /^\(.*\)$/.test(text);
  const value = Number(text.replace(/[()]/g, ''));
  if (text === '' || Number.isNaN(value)) return null;
  return negative ? -value : value;
}

/** Reads the opening receivables/payables CSV (header row first; see the template). */
export function parseOpeningOpenItemsCsv(text: string): ParsedOpeningOpenItemsCsv {
  const result = parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' });
  const rows: OpeningOpenItem[] = [];
  const badLineNumbers: number[] = [];
  result.data.slice(1).forEach((cells, index) => {
    const [type = '', party = '', number = '', issued = '', due = '', amount = '', description = ''] = cells;
    const partyType = partyTypeOf(type);
    const documentDate = dateOf(issued);
    const dueDate = dateOf(due);
    const value = amountOf(amount);
    if (!partyType || !party.trim() || documentDate === undefined || dueDate === undefined || value === null) {
      badLineNumbers.push(index + 2);
      return;
    }
    rows.push({
      partyType,
      partyId: null,
      partyRef: party.trim(),
      documentNumber: number.trim() || null,
      documentDate,
      dueDate,
      amount: value,
      description: description.trim() || null,
    });
  });
  return { rows, badLineNumbers };
}
