import { OpeningJournalLineInput } from '../models/opening-journal-input.model';

/** Parsed cutover CSV: the usable rows, and the 1-based line numbers that could not be read. */
export interface ParsedOpeningJournalCsv {
  lines: OpeningJournalLineInput[];
  badLineNumbers: number[];
}

function splitCsvRow(row: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (quoted) {
      if (ch === '"' && row[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function toAmount(cell: string | undefined): number | null {
  const text = (cell ?? '').replace(/[$\s,]/g, '');
  if (text === '') return 0;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Reads the §7A cutover template — `accountNumber, debit, credit, description?` per row, an optional
 * header row, blank rows ignored. A row is bad when its account is blank, an amount is not a
 * non-negative number, or it does not carry exactly one non-zero side.
 */
export function parseOpeningJournalCsv(text: string): ParsedOpeningJournalCsv {
  const lines: OpeningJournalLineInput[] = [];
  const badLineNumbers: number[] = [];
  const rows = text.split(/\r?\n/);
  rows.forEach((raw, index) => {
    if (raw.trim() === '') return;
    const [account, debitCell, creditCell, ...rest] = splitCsvRow(raw);
    if (index === 0 && /account/i.test(account) && toAmount(debitCell) === null) return;
    const debit = toAmount(debitCell);
    const credit = toAmount(creditCell);
    if (!account || debit === null || credit === null || (debit === 0) === (credit === 0)) {
      badLineNumbers.push(index + 1);
      return;
    }
    const description = rest.join(',').trim();
    lines.push({ accountNumber: account, debit, credit, description: description || null });
  });
  return { lines, badLineNumbers };
}
