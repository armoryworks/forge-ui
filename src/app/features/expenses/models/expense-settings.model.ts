export interface ExpenseSettings {
  allowSelfApproval: boolean;
  autoApproveThreshold: number | null;
  maxAmount: number | null;
  requireReceipt: boolean;
  minDescriptionLength: number;
}
