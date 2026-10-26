/** Header row of the payroll register CSV template; each header matches one category the import recognises. */
export const PAYROLL_REGISTER_TEMPLATE_HEADER = [
  'Employee Name', 'Gross Pay', 'Federal Tax', 'State Tax', 'Social Security', 'Medicare',
  'Other Deductions', 'Employer Taxes', 'Net Pay',
] as const;

/** One example row: gross less withholdings equals net. */
export const PAYROLL_REGISTER_TEMPLATE_EXAMPLE = [
  'Last, First', '2000.00', '180.00', '60.00', '124.00', '29.00', '0.00', '153.00', '1607.00',
] as const;
