import { ServerValidationError } from '../../../shared/utils/server-validation.utils';

/** A server validation error placed on its 1-based row (0 when it belongs to the load as a whole). */
export interface StockLoadRowError {
  row: number;
  code: string | null;
  message: string;
}

/** Places each `lines[i].field` error on row i + 1; anything else lands on row 0. */
export function stockLoadRowErrors(errors: ServerValidationError[]): StockLoadRowError[] {
  return errors.map((e) => {
    const match = /^lines\[(\d+)\]/i.exec(e.field ?? '');
    return { row: match ? Number(match[1]) + 1 : 0, code: e.code ?? null, message: e.message };
  });
}
