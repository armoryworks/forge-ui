import { CoaResult } from './coa-result.model';

export type CertificateOfAnalysisStatus = 'Issued' | 'Voided';

export interface CertificateOfAnalysis {
  id: number;
  certificateNumber: string;
  lotRecordId: number;
  lotNumber: string;
  partId: number;
  partNumber: string;
  partRevision: string | null;
  customerId: number | null;
  customerName: string | null;
  shipmentId: number | null;
  shipmentNumber: string | null;
  status: CertificateOfAnalysisStatus;
  conforms: boolean;
  language: string;
  generatedAt: string;
  generatedByName: string | null;
  fileAttachmentId: number | null;
  notes: string | null;
  results: CoaResult[];
}
