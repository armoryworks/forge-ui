export type CreditRisk = 'Low' | 'Medium' | 'High' | 'OnHold';

export interface CreditStatus {
  customerId: number;
  customerName: string;
  creditLimit: number | null;
  openArBalance: number;
  pendingOrdersTotal: number;
  totalExposure: number;
  availableCredit: number;
  utilizationPercent: number;
  isOnHold: boolean;
  holdReason: string | null;
  isOverLimit: boolean;
  riskLevel: CreditRisk;
  // Phase 3 / WU-14 / H3 / P4-OVERPAY — sum of unapplied portions of the
  // customer's payments, plus a per-payment breakdown so a salesperson can
  // tell the customer "you have $X credit on file" without manual lookup.
  unappliedCreditAmount: number;
  unappliedCredits: UnappliedCreditDetail[];
}

export interface UnappliedCreditDetail {
  paymentId: number;
  paymentNumber: string;
  date: string;
  amount: number;
  reference: string | null;
}
