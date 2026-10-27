export type DeliverableStatus = 'Draft' | 'In Review' | 'Approved' | 'Delivered';

export const DELIVERABLE_STATUS_KEYS: Record<DeliverableStatus, string> = {
  'Draft': 'deliverables.statusDraft',
  'In Review': 'deliverables.statusInReview',
  'Approved': 'deliverables.statusApproved',
  'Delivered': 'deliverables.statusDelivered',
};

export const DELIVERABLE_STATUS_CHIP: Record<DeliverableStatus, string> = {
  'Draft': 'chip--muted',
  'In Review': 'chip--warning',
  'Approved': 'chip--primary',
  'Delivered': 'chip--success',
};

/** The forward steps of the deliverable walk, and the step back from review. */
export const DELIVERABLE_NEXT_STEPS: Record<DeliverableStatus, { status: DeliverableStatus; labelKey: string }[]> = {
  'Draft': [{ status: 'In Review', labelKey: 'deliverables.sendForReview' }],
  'In Review': [
    { status: 'Approved', labelKey: 'deliverables.approve' },
    { status: 'Draft', labelKey: 'deliverables.returnToDraft' },
  ],
  'Approved': [{ status: 'Delivered', labelKey: 'deliverables.markDelivered' }],
  'Delivered': [],
};
