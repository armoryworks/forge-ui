export interface CreditMemoApplication {
  id: number;
  creditMemoId: number;
  creditMemoNumber: string | null;
  invoiceId: number;
  invoiceNumber: string | null;
  amount: number;
  appliedAt: string;
  reversedAt: string | null;
}
