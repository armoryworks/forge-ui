import { describe, expect, it } from 'vitest';

import { parseOpeningJournalCsv } from './opening-journal-csv';

describe('parseOpeningJournalCsv', () => {
  it('reads template rows after a header, keeping descriptions with commas', () => {
    const parsed = parseOpeningJournalCsv(
      'accountNumber,debit,credit,description\n10100,"10,000.00",0,Cash at bank\n30000,0,10000,"Opening equity, 2026"\n',
    );

    expect(parsed.badLineNumbers).toEqual([]);
    expect(parsed.lines).toEqual([
      { accountNumber: '10100', debit: 10000, credit: 0, description: 'Cash at bank' },
      { accountNumber: '30000', debit: 0, credit: 10000, description: 'Opening equity, 2026' },
    ]);
  });

  it('accepts rows without a header or description and skips blank lines', () => {
    const parsed = parseOpeningJournalCsv('10100,250,\n\n20000,,250');

    expect(parsed.lines.map((l) => [l.accountNumber, l.debit, l.credit, l.description])).toEqual([
      ['10100', 250, 0, null],
      ['20000', 0, 250, null],
    ]);
  });

  it('reports rows with both sides, no side, a negative amount or no account', () => {
    const parsed = parseOpeningJournalCsv('10100,5,5\n10200,0,0\n10300,-4,0\n,4,0\n10400,abc,0\n10500,4,0');

    expect(parsed.badLineNumbers).toEqual([1, 2, 3, 4, 5]);
    expect(parsed.lines).toHaveLength(1);
  });
});
