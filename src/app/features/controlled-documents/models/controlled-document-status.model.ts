export type ControlledDocumentStatus = 'Draft' | 'InReview' | 'Released' | 'Obsolete';

export const CONTROLLED_DOCUMENT_STATUSES: readonly ControlledDocumentStatus[] = ['Draft', 'InReview', 'Released', 'Obsolete'];

export const CONTROLLED_DOCUMENT_STATUS_CHIP: Record<ControlledDocumentStatus, string> = {
  Draft: 'chip--muted',
  InReview: 'chip--warning',
  Released: 'chip--success',
  Obsolete: 'chip--muted',
};
