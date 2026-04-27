// Phase 3 / WU-06 / C1 — Tenant-configurable rollup roles.
// Mirrors the server's RoleTemplateResponseModel.

export interface RoleTemplate {
  id: number;
  name: string;
  description: string | null;
  isSystemDefault: boolean;
  includedRoleNames: string[];
  assigneeCount: number;
  createdAt: string;
  deactivatedAt: string | null;
}

export interface CreateRoleTemplateRequest {
  name: string;
  description?: string | null;
  includedRoleNames: string[];
}

export interface UpdateRoleTemplateRequest {
  id: number;
  name: string;
  description?: string | null;
  includedRoleNames: string[];
}

export interface RoleTemplateAssignee {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
}
