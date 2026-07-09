/**
 * Customer acceptance record for a Sales Order (CAP-O2C-SO-ACCEPTANCE).
 *
 * A sales order may accumulate several acceptance records over its life
 * (an e-signature request, a follow-up manual upload, etc.); the newest-first
 * list is the audit history. A single `Accepted` record is what unblocks the
 * order's Confirm/release action.
 */
export type AcceptanceStatus = 'Pending' | 'Accepted' | 'Declined' | 'Revoked' | 'Expired';

export type AcceptanceMethod =
  | 'ManualUpload'
  | 'Fax'
  | 'Email'
  | 'Verbal'
  | 'QuotePortal'
  | 'PublicPortal'
  | 'ESignature'
  | 'ExternalSystem';

export interface SalesOrderAcceptance {
  id: number;
  salesOrderId: number;
  status: AcceptanceStatus;
  method: AcceptanceMethod;
  fileAttachmentId: number | null;
  fileName: string | null;
  recordedByUserId: number | null;
  recordedByName: string | null;
  acceptedByName: string | null;
  provider: string | null;
  providerReference: string | null;
  sentTo: string | null;
  note: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
}
