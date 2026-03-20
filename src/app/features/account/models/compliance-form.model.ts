export type ComplianceFormType = 'W4' | 'I9' | 'StateWithholding' | 'DirectDeposit' | 'WorkersComp' | 'Handbook';
export type ComplianceSubmissionStatus = 'Pending' | 'Opened' | 'Completed' | 'Expired' | 'Declined';
export type IdentityDocumentType =
  // Generic list identifiers (used when uploading without specifying exact document)
  | 'ListA' | 'ListB' | 'ListC'
  // List A — identity + employment authorization
  | 'Passport' | 'PermanentResidentCard' | 'EmploymentAuthorizationDoc' | 'ForeignPassportI551'
  // List B — identity only
  | 'DriversLicense' | 'StateIdCard' | 'SchoolId' | 'VoterRegistrationCard' | 'MilitaryId'
  // List C — employment authorization only
  | 'SsnCard' | 'BirthCertificate' | 'CitizenshipCertificate'
  | 'Other';

export const IDENTITY_DOC_LIST_A: IdentityDocumentType[] = ['ListA', 'Passport', 'PermanentResidentCard', 'EmploymentAuthorizationDoc', 'ForeignPassportI551'];
export const IDENTITY_DOC_LIST_B: IdentityDocumentType[] = ['ListB', 'DriversLicense', 'StateIdCard', 'SchoolId', 'VoterRegistrationCard', 'MilitaryId'];
export const IDENTITY_DOC_LIST_C: IdentityDocumentType[] = ['ListC', 'SsnCard', 'BirthCertificate', 'CitizenshipCertificate'];

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
  currentFormDefinitionVersionId: number | null;
  formDefinitionJson: string | null;
  formDefinitionRevision: string | null;
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
  formDataJson: string | null;
  formDefinitionVersionId: number | null;
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

export interface StateFormDefinitionResult {
  stateCode: string;
  stateName: string;
  category: string;
  formDefinitionVersionId: number | null;
  formDefinitionJson: string | null;
}

export interface StateWithholdingInfo {
  stateCode: string;
  stateName: string;
  category: 'no_tax' | 'federal' | 'state_form';
  formName: string | null;
  source: string;
}

export interface UserComplianceDetail {
  userId: number;
  userName: string;
  userEmail: string;
  submissions: ComplianceFormSubmission[];
  identityDocuments: IdentityDocument[];
  stateWithholdingInfo: StateWithholdingInfo | null;
}
