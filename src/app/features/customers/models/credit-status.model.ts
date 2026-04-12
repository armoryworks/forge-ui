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
}
