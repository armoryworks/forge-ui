export interface PaymentTerm {
  id: number;
  code: string;
  name: string;
  netDays: number;
  discountPercent: number;
  discountDays: number;
  legacyCreditTerms: string | null;
  isActive: boolean;
  sortOrder: number;
  isSystem: boolean;
}
