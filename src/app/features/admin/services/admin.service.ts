import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AdminUser } from '../models/admin-user.model';
import { CreateUserRequest, CreateUserResponse } from '../models/create-user-request.model';
import { UpdateUserRequest } from '../models/update-user-request.model';
import { CreateTrackTypeRequest } from '../models/create-track-type-request.model';
import { UpdateTrackTypeRequest } from '../models/update-track-type-request.model';
import { ReferenceDataGroup } from '../models/reference-data-group.model';
import { ReferenceDataEntry } from '../models/reference-data-entry.model';
import { TerminologyEntryItem } from '../models/terminology-entry-item.model';
import { SystemSetting } from '../models/system-setting.model';
import { TrackType } from '../../../shared/models/track-type.model';
import { CustomFieldDefinition } from '../models/custom-field-definition.model';
import { EmployeeDocument } from '../models/employee-document.model';
import { SalesTaxRate } from '../models/sales-tax-rate.model';
import { CreateSalesTaxRateRequest } from '../models/create-sales-tax-rate-request.model';
import { AuditLogEntry } from '../models/audit-log-entry.model';
import { StorageUsage } from '../models/storage-usage.model';
import { ScheduledTask } from '../models/scheduled-task.model';
import { CreateScheduledTaskRequest } from '../models/create-scheduled-task-request.model';
import { ScanIdentifier } from '../models/scan-identifier.model';
import { AiAssistant } from '../models/ai-assistant.model';
import { AdminTeam, TeamMember, KioskTerminal } from '../models/admin-team.model';
import { ComplianceFormTemplate, UserComplianceDetail } from '../../account/models/compliance-form.model';
import { CompanyLocation, CompanyProfile } from '../models/company-location.model';
import { IntegrationStatus, TestIntegrationResult } from '../models/integration-status.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly shopFloorBase = `${environment.apiUrl}/display/shop-floor`;

  // Users
  getUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${environment.apiUrl}/admin/users`);
  }

  createUser(request: CreateUserRequest): Observable<CreateUserResponse> {
    return this.http.post<CreateUserResponse>(`${environment.apiUrl}/admin/users`, request);
  }

  updateUser(id: number, request: UpdateUserRequest): Observable<AdminUser> {
    return this.http.put<AdminUser>(`${environment.apiUrl}/admin/users/${id}`, request);
  }

  // Track Types
  getTrackTypes(): Observable<TrackType[]> {
    return this.http.get<TrackType[]>(`${environment.apiUrl}/admin/track-types`);
  }

  createTrackType(request: CreateTrackTypeRequest): Observable<TrackType> {
    return this.http.post<TrackType>(`${environment.apiUrl}/admin/track-types`, request);
  }

  updateTrackType(id: number, request: UpdateTrackTypeRequest): Observable<TrackType> {
    return this.http.put<TrackType>(`${environment.apiUrl}/admin/track-types/${id}`, request);
  }

  deleteTrackType(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/admin/track-types/${id}`);
  }

  // Custom Field Definitions
  getCustomFieldDefinitions(trackTypeId: number): Observable<CustomFieldDefinition[]> {
    return this.http.get<CustomFieldDefinition[]>(`${environment.apiUrl}/track-types/${trackTypeId}/custom-fields`);
  }

  updateCustomFieldDefinitions(trackTypeId: number, fields: CustomFieldDefinition[]): Observable<CustomFieldDefinition[]> {
    return this.http.put<CustomFieldDefinition[]>(
      `${environment.apiUrl}/track-types/${trackTypeId}/custom-fields`,
      { fields });
  }

  // Reference Data
  getReferenceData(): Observable<ReferenceDataGroup[]> {
    return this.http.get<ReferenceDataGroup[]>(`${environment.apiUrl}/admin/reference-data`);
  }

  createReferenceData(request: { groupCode: string; code: string; label: string; sortOrder: number; metadata?: string }): Observable<ReferenceDataEntry> {
    return this.http.post<ReferenceDataEntry>(`${environment.apiUrl}/admin/reference-data`, request);
  }

  updateReferenceData(id: number, request: { label?: string; sortOrder?: number; isActive?: boolean; metadata?: string }): Observable<ReferenceDataEntry> {
    return this.http.put<ReferenceDataEntry>(`${environment.apiUrl}/admin/reference-data/${id}`, request);
  }

  // Terminology
  getTerminology(): Observable<TerminologyEntryItem[]> {
    return this.http.get<TerminologyEntryItem[]>(`${environment.apiUrl}/terminology`);
  }

  updateTerminology(entries: TerminologyEntryItem[]): Observable<TerminologyEntryItem[]> {
    return this.http.put<TerminologyEntryItem[]>(`${environment.apiUrl}/terminology`, { entries });
  }

  // System Settings
  getSystemSettings(): Observable<SystemSetting[]> {
    return this.http.get<SystemSetting[]>(`${environment.apiUrl}/admin/system-settings`);
  }

  updateSystemSettings(settings: { key: string; value: string; description?: string | null }[]): Observable<SystemSetting[]> {
    return this.http.put<SystemSetting[]>(`${environment.apiUrl}/admin/system-settings`, { settings });
  }

  // Pay Period Locking
  lockPayPeriod(lockThrough: Date): Observable<{ lockedCount: number }> {
    return this.http.post<{ lockedCount: number }>(`${environment.apiUrl}/time-tracking/lock-period`, {
      lockThrough: lockThrough.toISOString(),
    });
  }

  // Logo
  uploadLogo(file: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<void>(`${environment.apiUrl}/admin/logo`, formData);
  }

  deleteLogo(): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/admin/logo`);
  }

  // Sales Tax Rates
  getSalesTaxRates(): Observable<SalesTaxRate[]> {
    return this.http.get<SalesTaxRate[]>(`${environment.apiUrl}/sales-tax-rates`);
  }

  createSalesTaxRate(request: CreateSalesTaxRateRequest): Observable<SalesTaxRate> {
    return this.http.post<SalesTaxRate>(`${environment.apiUrl}/sales-tax-rates`, request);
  }

  updateSalesTaxRate(id: number, request: CreateSalesTaxRateRequest): Observable<SalesTaxRate> {
    return this.http.put<SalesTaxRate>(`${environment.apiUrl}/sales-tax-rates/${id}`, request);
  }

  deleteSalesTaxRate(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/sales-tax-rates/${id}`);
  }

  getEmployeeDocuments(userId: number): Observable<EmployeeDocument[]> {
    return this.http.get<EmployeeDocument[]>(`${environment.apiUrl}/admin/users/${userId}/documents`);
  }

  // Audit Log
  getAuditLog(params: {
    userId?: number; action?: string; entityType?: string;
    from?: string; to?: string; page?: number; pageSize?: number;
  }): Observable<{ data: AuditLogEntry[]; page: number; pageSize: number; totalCount: number; totalPages: number }> {
    return this.http.get<{ data: AuditLogEntry[]; page: number; pageSize: number; totalCount: number; totalPages: number }>(
      `${environment.apiUrl}/admin/audit-log`, { params: params as Record<string, string> });
  }

  // Storage Usage
  getStorageUsage(): Observable<StorageUsage[]> {
    return this.http.get<StorageUsage[]>(`${environment.apiUrl}/admin/storage-usage`);
  }

  // Scheduled Tasks
  getScheduledTasks(): Observable<ScheduledTask[]> {
    return this.http.get<ScheduledTask[]>(`${environment.apiUrl}/scheduled-tasks`);
  }

  createScheduledTask(request: CreateScheduledTaskRequest): Observable<ScheduledTask> {
    return this.http.post<ScheduledTask>(`${environment.apiUrl}/scheduled-tasks`, request);
  }

  updateScheduledTask(id: number, request: Partial<CreateScheduledTaskRequest & { isActive: boolean }>): Observable<ScheduledTask> {
    return this.http.put<ScheduledTask>(`${environment.apiUrl}/scheduled-tasks/${id}`, request);
  }

  deleteScheduledTask(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/scheduled-tasks/${id}`);
  }

  runScheduledTask(id: number): Observable<{ jobId: number }> {
    return this.http.post<{ jobId: number }>(`${environment.apiUrl}/scheduled-tasks/${id}/run`, {});
  }

  // Setup Token & Invite
  generateSetupToken(userId: number): Observable<{ token: string; expiresAt: string }> {
    return this.http.post<{ token: string; expiresAt: string }>(`${environment.apiUrl}/admin/users/${userId}/setup-token`, {});
  }

  sendSetupInvite(userId: number, baseUrl: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/admin/users/${userId}/send-invite?baseUrl=${encodeURIComponent(baseUrl)}`, {});
  }

  resetUserPin(userId: number): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/admin/users/${userId}/reset-pin`, {});
  }

  deactivateUser(userId: number): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/admin/users/${userId}/deactivate`, {});
  }

  reactivateUser(userId: number): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/admin/users/${userId}/reactivate`, {});
  }

  // Scan Identifiers (RFID, NFC, barcode, biometric)
  getScanIdentifiers(userId: number): Observable<ScanIdentifier[]> {
    return this.http.get<ScanIdentifier[]>(`${environment.apiUrl}/admin/users/${userId}/scan-identifiers`);
  }

  addScanIdentifier(userId: number, identifierType: string, identifierValue: string): Observable<ScanIdentifier> {
    return this.http.post<ScanIdentifier>(
      `${environment.apiUrl}/admin/users/${userId}/scan-identifiers`,
      { identifierType, identifierValue });
  }

  removeScanIdentifier(userId: number, id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/admin/users/${userId}/scan-identifiers/${id}`);
  }

  // AI Assistants
  getAiAssistants(): Observable<AiAssistant[]> {
    return this.http.get<AiAssistant[]>(`${environment.apiUrl}/ai-assistants/all`);
  }

  createAiAssistant(data: Partial<AiAssistant>): Observable<AiAssistant> {
    return this.http.post<AiAssistant>(`${environment.apiUrl}/ai-assistants`, data);
  }

  updateAiAssistant(id: number, data: Partial<AiAssistant>): Observable<AiAssistant> {
    return this.http.put<AiAssistant>(`${environment.apiUrl}/ai-assistants/${id}`, data);
  }

  deleteAiAssistant(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/ai-assistants/${id}`);
  }

  // Teams & Kiosks
  getTeams(): Observable<AdminTeam[]> {
    return this.http.get<AdminTeam[]>(`${this.shopFloorBase}/teams`);
  }

  createTeam(request: { name: string; color?: string; description?: string }): Observable<AdminTeam> {
    return this.http.post<AdminTeam>(`${this.shopFloorBase}/teams`, request);
  }

  updateTeam(id: number, request: { id: number; name: string; color?: string | null; description?: string | null; isActive: boolean }): Observable<AdminTeam> {
    return this.http.put<AdminTeam>(`${this.shopFloorBase}/teams/${id}`, request);
  }

  deleteTeam(id: number): Observable<void> {
    return this.http.delete<void>(`${this.shopFloorBase}/teams/${id}`);
  }

  getTeamMembers(teamId: number): Observable<TeamMember[]> {
    return this.http.get<TeamMember[]>(`${this.shopFloorBase}/teams/${teamId}/members`);
  }

  assignTeamMembers(teamId: number, userIds: number[]): Observable<void> {
    return this.http.put<void>(`${this.shopFloorBase}/teams/${teamId}/members`, { userIds });
  }

  getKioskTerminals(): Observable<KioskTerminal[]> {
    return this.http.get<KioskTerminal[]>(`${this.shopFloorBase}/terminals`);
  }

  // State Withholding Reference Data
  getStateWithholdingData(): Observable<ReferenceDataEntry[]> {
    return this.http.get<ReferenceDataEntry[]>(`${environment.apiUrl}/reference-data/state_withholding`);
  }

  setCompanyState(stateCode: string): Observable<SystemSetting[]> {
    return this.http.put<SystemSetting[]>(`${environment.apiUrl}/admin/system-settings`, {
      settings: [{ key: 'company_state', value: stateCode }],
    });
  }

  // Compliance Forms
  private readonly complianceBase = `${environment.apiUrl}/compliance-forms`;

  getComplianceTemplates(): Observable<ComplianceFormTemplate[]> {
    return this.http.get<ComplianceFormTemplate[]>(this.complianceBase, {
      params: { includeInactive: 'true' },
    });
  }

  createComplianceTemplate(request: Partial<ComplianceFormTemplate>): Observable<ComplianceFormTemplate> {
    return this.http.post<ComplianceFormTemplate>(this.complianceBase, request);
  }

  updateComplianceTemplate(id: number, request: Partial<ComplianceFormTemplate>): Observable<ComplianceFormTemplate> {
    return this.http.put<ComplianceFormTemplate>(`${this.complianceBase}/${id}`, request);
  }

  deleteComplianceTemplate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.complianceBase}/${id}`);
  }

  uploadTemplateDocument(id: number, fileAttachmentId: number): Observable<ComplianceFormTemplate> {
    return this.http.post<ComplianceFormTemplate>(`${this.complianceBase}/${id}/upload`, { fileAttachmentId });
  }

  syncComplianceTemplate(id: number): Observable<void> {
    return this.http.post<void>(`${this.complianceBase}/${id}/sync`, {});
  }

  extractFormDefinition(id: number): Observable<unknown> {
    return this.http.post(`${this.complianceBase}/${id}/extract-definition`, {});
  }

  syncAllComplianceTemplates(): Observable<void> {
    return this.http.post<void>(`${this.complianceBase}/sync-all`, {});
  }

  getUserComplianceDetail(userId: number): Observable<UserComplianceDetail> {
    return this.http.get<UserComplianceDetail>(`${this.complianceBase}/admin/users/${userId}`);
  }

  sendComplianceReminder(userId: number): Observable<void> {
    return this.http.post<void>(`${this.complianceBase}/admin/users/${userId}/remind`, {});
  }

  verifyIdentityDocument(documentId: number): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/identity-documents/admin/${documentId}/verify`, {});
  }

  // Company Locations
  private readonly locationsBase = `${environment.apiUrl}/company-locations`;

  getCompanyLocations(): Observable<CompanyLocation[]> {
    return this.http.get<CompanyLocation[]>(this.locationsBase);
  }

  createCompanyLocation(request: Partial<CompanyLocation>): Observable<CompanyLocation> {
    return this.http.post<CompanyLocation>(this.locationsBase, request);
  }

  updateCompanyLocation(id: number, request: Partial<CompanyLocation>): Observable<CompanyLocation> {
    return this.http.put<CompanyLocation>(`${this.locationsBase}/${id}`, request);
  }

  deleteCompanyLocation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.locationsBase}/${id}`);
  }

  setDefaultCompanyLocation(id: number): Observable<void> {
    return this.http.post<void>(`${this.locationsBase}/${id}/set-default`, {});
  }

  // Company Profile
  getCompanyProfile(): Observable<CompanyProfile> {
    return this.http.get<CompanyProfile>(`${environment.apiUrl}/admin/company-profile`);
  }

  updateCompanyProfile(data: Partial<CompanyProfile>): Observable<CompanyProfile> {
    return this.http.patch<CompanyProfile>(`${environment.apiUrl}/admin/company-profile`, data);
  }

  // User Work Location
  updateUserWorkLocation(userId: number, workLocationId: number | null): Observable<void> {
    return this.http.patch<void>(`${environment.apiUrl}/admin/users/${userId}/work-location`, { workLocationId });
  }

  // Integrations
  getIntegrations(): Observable<IntegrationStatus[]> {
    return this.http.get<IntegrationStatus[]>(`${environment.apiUrl}/admin/integrations`);
  }

  updateIntegration(provider: string, settings: Record<string, string>): Observable<IntegrationStatus> {
    return this.http.put<IntegrationStatus>(`${environment.apiUrl}/admin/integrations/${provider}`, { settings });
  }

  testIntegration(provider: string): Observable<TestIntegrationResult> {
    return this.http.post<TestIntegrationResult>(`${environment.apiUrl}/admin/integrations/${provider}/test`, {});
  }
}
