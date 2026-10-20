import { unparse } from 'papaparse';

import { downloadBlob } from './download-blob';

/**
 * Text a spreadsheet would evaluate as a formula: a leading `=`, `+`, `@`, tab or CR, or a leading `-`
 * that is not followed by an amount (`-12.50`, `-$1,234.00` and `-5%` stay as they are).
 */
export const CSV_FORMULA_PATTERN = /^(?:[=+@\t\r]|-(?![\d$€£¥.,\s%()]*$))/;

/**
 * Builds a CSV from `rows` (header rows included, one array per line; rows may differ in length) and
 * hands it to the browser as `<baseName>.csv`.
 * The file starts with a UTF-8 byte order mark so Excel reads it as UTF-8, and formula-like text
 * (see {@link CSV_FORMULA_PATTERN}) is prefixed with a single quote so it opens as plain text.
 */
export function downloadCsv(rows: unknown[][], baseName: string): void {
  const csv = unparse(rows, { escapeFormulae: CSV_FORMULA_PATTERN });
  downloadBlob(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }), `${baseName}.csv`);
}
