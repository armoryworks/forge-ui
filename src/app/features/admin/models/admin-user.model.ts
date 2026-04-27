export interface AdminUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  initials: string | null;
  avatarColor: string | null;
  isActive: boolean;
  roles: string[];
  createdAt: Date;
  hasPassword: boolean;
  hasPendingSetupToken: boolean;
  hasRfidIdentifier: boolean;
  hasBarcodeIdentifier: boolean;
  canBeAssignedJobs: boolean;
  complianceCompletedItems: number;
  complianceTotalItems: number;
  missingComplianceItems: string[];
  workLocationId: number | null;
  workLocationName: string | null;
  i9Status: I9ComplianceStatus | null;
  // Phase 3 / WU-06 / C1 — rollup template assignment.
  roleTemplateId: number | null;
  roleTemplateName: string | null;
  roleTemplateIncludedRoles: string[] | null;
}

export type I9ComplianceStatus =
  | 'NotStarted'
  | 'Section1InProgress'
  | 'Section1Complete'
  | 'Section2InProgress'
  | 'Complete'
  | 'Section2Overdue'
  | 'ReverificationDue'
  | 'ReverificationOverdue';
