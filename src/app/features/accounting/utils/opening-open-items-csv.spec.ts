import { describe, expect, it } from 'vitest';

import { parseOpeningOpenItemsCsv } from './opening-open-items-csv';

describe('parseOpeningOpenItemsCsv', () => {
  it('reads customer and vendor rows with ISO or US dates, $ amounts and a BOM', () => {
    const csv = '﻿partyType,party,documentNumber,documentDate,dueDate,amount,description\n'
      + 'Customer,CUST-0001,INV-1,2025-12-01,12/31/2025,"$1,200.00",Open invoice\n'
      + 'vendor,Steel Supply,,,,450,\n';

    const parsed = parseOpeningOpenItemsCsv(csv);

    expect(parsed.badLineNumbers).toEqual([]);
    expect(parsed.rows).toEqual([
      { partyType: 'Customer', partyId: null, partyRef: 'CUST-0001', documentNumber: 'INV-1', documentDate: '2025-12-01', dueDate: '2025-12-31', amount: 1200, description: 'Open invoice' },
      { partyType: 'Vendor', partyId: null, partyRef: 'Steel Supply', documentNumber: null, documentDate: null, dueDate: null, amount: 450, description: null },
    ]);
  });

  it('names the lines it cannot read', () => {
    const csv = 'partyType,party,documentNumber,documentDate,dueDate,amount,description\n'
      + 'Lender,X,,,,10,\n'
      + 'Customer,,,,,10,\n'
      + 'Customer,A,,31-12-2025,,10,\n'
      + 'Customer,A,,,,abc,\n'
      + 'Customer,A,,,,10,\n';

    const parsed = parseOpeningOpenItemsCsv(csv);

    expect(parsed.badLineNumbers).toEqual([2, 3, 4, 5]);
    expect(parsed.rows).toHaveLength(1);
  });
});
