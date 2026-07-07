/** Payload linking an already-uploaded customer file as a tax certificate (S1). */
export interface CreateCustomerTaxDocumentRequest {
  fileAttachmentId: number;
  stateCode: string;
  certificateType: string;
  certificateNumber?: string;
  expirationDate?: string;
}
