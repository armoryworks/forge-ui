export type DocumentRevisionStatus = 'Draft' | 'InReview' | 'Approved' | 'Rejected' | 'Superseded';

export const DOCUMENT_REVISION_STATUS_CHIP: Record<DocumentRevisionStatus, string> = {
  Draft: 'chip--muted',
  InReview: 'chip--warning',
  Approved: 'chip--success',
  Rejected: 'chip--error',
  Superseded: 'chip--muted',
};
