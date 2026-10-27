/** One parsed CSV data row, keyed by its lower-cased, trimmed header. */
export type CsvRecord = Record<string, string | undefined>;
