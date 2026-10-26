/** Header row of the opening-stock CSV template, in the column order the server reads. */
export const STOCK_LOAD_TEMPLATE_HEADER = ['partNumber', 'location', 'lot', 'expirationDate', 'quantity', 'unitCost'] as const;

/** One example row that shows the formats (ISO date, invariant numbers). */
export const STOCK_LOAD_TEMPLATE_EXAMPLE = ['PART-001', 'A1', '', '', '10', '12.50'] as const;
