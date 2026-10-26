import { PaymentTerm } from './payment-term.model';

function term(id: number, code: string, name: string, netDays: number, legacy: string | null, discountPercent = 0, discountDays = 0): PaymentTerm {
  return { id, code, name, netDays, discountPercent, discountDays, legacyCreditTerms: legacy, isActive: true, sortOrder: id * 10, isSystem: true };
}

/** The seeded payment terms, as the API returns them, for specs. */
export const SEEDED_PAYMENT_TERMS: PaymentTerm[] = [
  term(1, 'DueOnReceipt', 'Due on receipt', 0, 'DueOnReceipt'),
  term(2, 'COD', 'COD', 0, null),
  term(3, 'Net15', 'Net 15', 15, 'Net15'),
  term(4, 'Net30', 'Net 30', 30, 'Net30'),
  term(5, 'Net45', 'Net 45', 45, 'Net45'),
  term(6, 'Net60', 'Net 60', 60, 'Net60'),
  term(7, 'Net90', 'Net 90', 90, 'Net90'),
  term(8, '1/10Net30', '1/10 Net 30', 30, null, 1, 10),
  term(9, '2/10Net30', '2/10 Net 30', 30, null, 2, 10),
  term(10, '2/10Net60', '2/10 Net 60', 60, null, 2, 10),
];
