/** One variance account's net over the range; a negative amount is favorable. */
export interface VarianceLine {
  key: string;
  name: string;
  amount: number;
  isFavorable: boolean;
}

/** Standard-cost variance rollup for a date range (`GET accounting/variances`). */
export interface VarianceReport {
  bookId: number;
  from: string;
  to: string;
  lines: VarianceLine[];
  total: number;
}
