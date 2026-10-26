export interface ResolveCustomerReturnRequest {
  disposition: string;
  quantity?: number | null;
  restockLocationId?: number | null;
  lotNumber?: string | null;
  issueCredit?: boolean;
  creditAmount?: number | null;
  restockingFeePercent?: number | null;
}
