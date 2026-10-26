export interface PortalCredit {
  kind: 'CreditMemo' | 'Refund';
  id: number;
  number: string;
  date: string;
  description: string;
  amount: number;
  openAmount: number;
  status: string;
  currencyCode: string | null;
}
