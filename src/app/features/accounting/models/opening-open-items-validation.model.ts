import { OpeningOpenItemResult } from './opening-open-item-result.model';

/** Dry run of the opening AR/AP open items — mirrors `OpeningOpenItemsValidationModel`. */
export interface OpeningOpenItemsValidation {
  alreadyPosted: boolean;
  receivablesTotal: number;
  payablesTotal: number;
  errorCount: number;
  rows: OpeningOpenItemResult[];
}
