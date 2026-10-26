import { PaymentTermsSummary } from '../models/payment-terms-summary.model';
import { toCalendarDate } from './date.utils';
import { roundMoney } from './money.utils';

type TermsDays = Pick<PaymentTermsSummary, 'netDays' | 'discountPercent' | 'discountDays'>;

function addDays(documentDate: Date, days: number): Date {
  const d = toCalendarDate(documentDate);
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  result.setDate(result.getDate() + days);
  return result;
}

/** The due date the terms give a document dated `documentDate`: the document date plus net days. */
export function dueDateForTerms(documentDate: Date, terms: TermsDays | null | undefined): Date | null {
  return terms ? addDays(documentDate, terms.netDays) : null;
}

/** The last day the early-payment discount may be taken, or null when the terms carry none. */
export function discountDateForTerms(documentDate: Date, terms: TermsDays | null | undefined): Date | null {
  return terms && terms.discountPercent > 0 && terms.discountDays > 0 ? addDays(documentDate, terms.discountDays) : null;
}

/** True when the terms carry an early-payment discount. */
export function hasDiscount(terms: TermsDays | null | undefined): boolean {
  return !!terms && terms.discountPercent > 0 && terms.discountDays > 0;
}

/** True when a payment dated `paymentDate` is on or before the discount deadline, by calendar day. */
export function inDiscountWindow(deadline: Date | string | null | undefined, paymentDate: Date | string | null | undefined): boolean {
  if (!deadline || !paymentDate) return false;
  const end = toCalendarDate(deadline);
  const paid = toCalendarDate(paymentDate);
  return new Date(paid.getFullYear(), paid.getMonth(), paid.getDate()).getTime()
    <= new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
}

/**
 * The discount a cash application earns, the same rule the API applies: a payment that settles the balance
 * once the rest of the discount is taken gets that rest; a smaller one earns cash × pct / (1 − pct), capped.
 */
export function automaticDiscount(cash: number, balanceDue: number, remaining: number, discountPercent: number): number {
  if (cash <= 0 || remaining <= 0 || discountPercent <= 0 || discountPercent >= 100 || balanceDue <= 0) return 0;
  if (cash + remaining >= balanceDue) return Math.max(0, Math.min(remaining, roundMoney(balanceDue - cash)));
  const rate = discountPercent / 100;
  return Math.min(remaining, roundMoney(cash * rate / (1 - rate)));
}
