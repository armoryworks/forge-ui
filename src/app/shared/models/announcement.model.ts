export type AnnouncementSeverity = 'Info' | 'Warning' | 'Critical';
export type AnnouncementScope = 'CompanyWide' | 'Department' | 'SelectedTeams' | 'IndividualTeam' | 'TeamLeadsOnly';

export interface Announcement {
  id: number;
  title: string;
  content: string;
  severity: AnnouncementSeverity;
  scope: AnnouncementScope;
  requiresAcknowledgment: boolean;
  expiresAt: string | null;
  isSystemGenerated: boolean;
  systemSource: string | null;
  createdById: number;
  createdByName: string;
  createdAt: string;
  acknowledgmentCount: number;
  targetUserCount: number;
  isAcknowledgedByCurrentUser: boolean;
  targetTeamIds: number[];
}

export interface CreateAnnouncementRequest {
  title: string;
  content: string;
  severity: AnnouncementSeverity;
  scope: AnnouncementScope;
  requiresAcknowledgment: boolean;
  expiresAt?: string | null;
  departmentId?: number | null;
  targetTeamIds?: number[];
  templateId?: number | null;
}

export interface AnnouncementAcknowledgment {
  userId: number;
  userName: string;
  acknowledgedAt: string;
}

export interface AnnouncementTemplate {
  id: number;
  name: string;
  content: string;
  defaultSeverity: AnnouncementSeverity;
  defaultScope: AnnouncementScope;
  defaultRequiresAcknowledgment: boolean;
}

export interface CreateAnnouncementTemplateRequest {
  name: string;
  content: string;
  defaultSeverity: AnnouncementSeverity;
  defaultScope: AnnouncementScope;
  defaultRequiresAcknowledgment: boolean;
}
