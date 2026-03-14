export type ComplianceFormType = 'W4' | 'I9' | 'StateWithholding' | 'DirectDeposit' | 'WorkersComp' | 'Handbook';
export type ComplianceSubmissionStatus = 'Pending' | 'Opened' | 'Completed' | 'Expired' | 'Declined';
export type IdentityDocumentType = 'BirthCertificate' | 'DriversLicense' | 'SsnCard' | 'Passport' | 'PermanentResidentCard' | 'Other';

export interface ComplianceFormTemplate {
  id: number;
  name: string;
  formType: ComplianceFormType;
  description: string;
  icon: string;
  sourceUrl: string | null;
  isAutoSync: boolean;
  isActive: boolean;
  sortOrder: number;
  requiresIdentityDocs: boolean;
  docuSealTemplateId: number | null;
  lastSyncedAt: string | null;
  manualOverrideFileId: number | null;
  blocksJobAssignment: boolean;
  profileCompletionKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceFormSubmission {
  id: number;
  templateId: number;
  templateName: string;
  formType: ComplianceFormType;
  status: ComplianceSubmissionStatus;
  signedAt: string | null;
  signedPdfFileId: number | null;
  docuSealSubmitUrl: string | null;
  createdAt: string;
}

export interface IdentityDocument {
  id: number;
  userId: number;
  documentType: IdentityDocumentType;
  fileAttachmentId: number;
  fileName: string;
  verifiedAt: string | null;
  verifiedById: number | null;
  verifiedByName: string | null;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface UserComplianceDetail {
  userId: number;
  userName: string;
  userEmail: string;
  submissions: ComplianceFormSubmission[];
  identityDocuments: IdentityDocument[];
}
