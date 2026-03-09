export interface AdminUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  initials: string | null;
  avatarColor: string | null;
  isActive: boolean;
  roles: string[];
  createdAt: string;
}

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  initials?: string;
  avatarColor?: string;
  password: string;
  role: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  initials?: string;
  avatarColor?: string;
  isActive?: boolean;
  role?: string;
}

export interface TrackType {
  id: number;
  name: string;
  code: string;
  description: string | null;
  isDefault: boolean;
  sortOrder: number;
  stages: Stage[];
}

export interface Stage {
  id: number;
  name: string;
  code: string;
  sortOrder: number;
  color: string;
  wipLimit: number | null;
  accountingDocumentType: string | null;
  isIrreversible: boolean;
}

export interface ReferenceDataGroup {
  groupCode: string;
  values: ReferenceDataEntry[];
}

export interface ReferenceDataEntry {
  id: number;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  metadata: string | null;
}

export interface StageRequest {
  name: string;
  code: string;
  sortOrder: number;
  color: string;
  wipLimit: number | null;
  isIrreversible: boolean;
}

export interface CreateTrackTypeRequest {
  name: string;
  code: string;
  description: string | null;
  stages: StageRequest[];
}

export interface UpdateTrackTypeRequest {
  name: string;
  code: string;
  description: string | null;
  stages: StageRequest[];
}

export interface TerminologyEntryItem {
  key: string;
  label: string;
}
