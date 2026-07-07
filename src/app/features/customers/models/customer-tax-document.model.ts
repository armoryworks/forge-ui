/** A customer's state tax certificate (S1) with its verification workflow state. */
export interface CustomerTaxDocument {
  id: number;
  fileAttachmentId: number;
  fileName: string;
  stateCode: string | null;
  certificateType: string;
  certificateNumber: string | null;
  status: 'Pending' | 'Verified' | 'Rejected' | 'Expired';
  verifiedAt: string | null;
  verifiedByName: string | null;
  expirationDate: string | null;
  rejectionReason: string | null;
}
