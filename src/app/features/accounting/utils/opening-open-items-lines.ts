import { OpeningBalanceLine } from '../models/opening-balance-line.model';
import { OpeningOpenItem } from '../models/opening-open-item.model';

export const OPENING_OFFSET_KEY = 'OPENING_BALANCE_EQUITY';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The opening-balance journal for checked open items: each receivable a debit on AR control and each payable
 * a credit on AP control, both naming the party resolved by the dry run (`partyIds[i]`), and the net to
 * Opening Balance Equity so the entry balances.
 */
export function openingOpenItemsLines(items: OpeningOpenItem[], partyIds: (number | null)[]): OpeningBalanceLine[] {
  const lines: OpeningBalanceLine[] = items.map((item, i) => {
    const receivable = item.partyType === 'Customer';
    return {
      accountDeterminationKey: receivable ? 'AR_CONTROL' : 'AP_CONTROL',
      glAccountId: null,
      debit: receivable ? round2(item.amount) : 0,
      credit: receivable ? 0 : round2(item.amount),
      partyType: item.partyType,
      partyId: partyIds[i] ?? item.partyId,
      description: item.description,
      documentNumber: item.documentNumber,
      documentDate: item.documentDate,
      dueDate: item.dueDate,
    };
  });
  const net = round2(lines.reduce((sum, l) => sum + l.debit - l.credit, 0));
  if (net !== 0) {
    lines.push({
      accountDeterminationKey: OPENING_OFFSET_KEY,
      glAccountId: null,
      debit: net < 0 ? -net : 0,
      credit: net > 0 ? net : 0,
      partyType: null,
      partyId: null,
      description: 'Opening receivables and payables offset',
    });
  }
  return lines;
}

/** Party total less the legacy control balance, rounded to the cent (0 = ties). Null until the control is entered. */
export function tieOutDifference(partyTotal: number, controlTotal: number | null): number | null {
  return controlTotal === null ? null : round2(partyTotal - controlTotal);
}
