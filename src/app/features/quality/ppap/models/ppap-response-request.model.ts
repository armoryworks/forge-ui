export type PpapCustomerDecision = 'Approved' | 'Rejected' | 'Interim';

export interface PpapResponseRequest {
  customerDecision: PpapCustomerDecision;
  notes: string | null;
}
