/** The dry-run check of one opening open item — mirrors `OpeningOpenItemRowResultModel`. */
export interface OpeningOpenItemResult {
  rowNumber: number;
  partyId: number | null;
  partyName: string | null;
  errors: string[];
}
