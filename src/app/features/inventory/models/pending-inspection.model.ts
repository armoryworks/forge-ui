export type ReceivingInspectionStatus = 'NotRequired' | 'Pending' | 'InProgress' | 'Passed' | 'Failed' | 'Waived' | 'PartialAccept';

export interface PendingInspectionItem {
  receivingRecordId: number;
  partNumber: string;
  partDescription: string;
  poNumber: string;
  vendorName: string;
  receivedQuantity: number;
  receivedAt: string;
  qcTemplateName: string | null;
  daysWaiting: number;
}
