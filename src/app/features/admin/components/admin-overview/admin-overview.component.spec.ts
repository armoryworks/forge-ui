import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { AdminOverviewComponent } from './admin-overview.component';
import { AdminUser } from '../../models/admin-user.model';
import { AuditLogEntry } from '../../models/audit-log-entry.model';
import { IntegrationRecord } from '../../models/integration-record.model';
import { ScheduledTask } from '../../models/scheduled-task.model';
import { StorageUsage } from '../../models/storage-usage.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface OverviewInternals {
  ngOnInit(): void;
  goTo(route: string): void;
  users: { (): AdminUser[] };
  auditEntries: { (): AuditLogEntry[] };
  connections: { (): IntegrationRecord[] };
  connectionsAvailable: { (): boolean };
  scheduledTasks: { (): ScheduledTask[] };
  storageUsage: { (): StorageUsage[] };
  activeUserCount: { (): number };
  roleBreakdown: { (): { role: string; count: number }[] };
  expiredKeyCount: { (): number };
  complianceOpenCount: { (): number };
  i9AttentionCount: { (): number };
  activeScheduledTaskCount: { (): number };
  nextScheduledRun: { (): Date | null };
  totalFileCount: { (): number };
  totalStorageDisplay: { (): string };
  topStorageEntity: { (): { entityType: string; display: string } | null };
  isLoading: { (): boolean };
}

const usersUrl = `${environment.apiUrl}/admin/users`;
const auditUrl = `${environment.apiUrl}/admin/audit-log`;
const connectionsUrl = `${environment.apiUrl}/admin/connections`;
const scheduledTasksUrl = `${environment.apiUrl}/scheduled-tasks`;
const storageUrl = `${environment.apiUrl}/admin/storage-usage`;

/** Flush every endpoint with the supplied fixture (or empty defaults). */
function flushAll(
  httpMock: HttpTestingController,
  fixtures: {
    users?: AdminUser[];
    audit?: AuditLogEntry[];
    connections?: IntegrationRecord[];
    scheduledTasks?: ScheduledTask[];
    storage?: StorageUsage[];
  } = {},
): void {
  httpMock.expectOne(usersUrl).flush(fixtures.users ?? []);
  httpMock.expectOne((req) => req.url === auditUrl).flush({
    data: fixtures.audit ?? [], page: 1, pageSize: 5, totalCount: 0, totalPages: 0,
  });
  httpMock.expectOne(connectionsUrl).flush(fixtures.connections ?? []);
  httpMock.expectOne(scheduledTasksUrl).flush(fixtures.scheduledTasks ?? []);
  httpMock.expectOne(storageUrl).flush(fixtures.storage ?? []);
}

function setup(routerStub?: Partial<Router>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimations(),
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: Router, useValue: routerStub ?? { navigateByUrl: vi.fn() } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new AdminOverviewComponent());
  const httpMock = TestBed.inject(HttpTestingController);
  const router = TestBed.inject(Router) as unknown as { navigateByUrl: ReturnType<typeof vi.fn> };
  return { component: component as unknown as OverviewInternals, httpMock, router };
}

function makeUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 1, email: 'a@example.test', firstName: 'A', lastName: 'B',
    initials: 'AB', avatarColor: null, isActive: true, roles: ['Engineer'],
    createdAt: new Date('2026-05-01T00:00:00Z'),
    hasPassword: true, hasPendingSetupToken: false,
    hasRfidIdentifier: false, hasBarcodeIdentifier: false,
    canBeAssignedJobs: true,
    complianceCompletedItems: 0, complianceTotalItems: 0, missingComplianceItems: [],
    workLocationId: null, workLocationName: null,
    i9Status: null,
    ...overrides,
  };
}

function makeTask(overrides: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: 1, name: 'Nightly cleanup', description: null,
    trackTypeId: 1, trackTypeName: 'Maintenance',
    internalProjectTypeId: null, assigneeId: null,
    cronExpression: '0 0 * * *', isActive: true,
    lastRunAt: null, nextRunAt: new Date('2026-06-01T08:00:00Z'),
    createdAt: new Date('2026-05-01T00:00:00Z'),
    ...overrides,
  };
}

describe('AdminOverviewComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('counts active users only — inactive rows are excluded from the headline', () => {
    const { component, httpMock } = setup();
    component.ngOnInit();
    flushAll(httpMock, {
      users: [
        makeUser({ id: 1, roles: ['Admin'], isActive: true }),
        makeUser({ id: 2, roles: ['Engineer'], isActive: true }),
        makeUser({ id: 3, roles: ['Engineer'], isActive: false }),
      ],
    });

    expect(component.activeUserCount()).toBe(2);
    const roles = component.roleBreakdown().map(r => r.role);
    expect(roles).toContain('Admin');
    expect(roles).toContain('Engineer');
    expect(component.isLoading()).toBe(false);
    httpMock.verify();
  });

  it('expiredKeyCount surfaces only Status === "Expired" rows from the connections registry', () => {
    const { component, httpMock } = setup();
    component.ngOnInit();
    flushAll(httpMock, {
      connections: [
        { kind: 'BiApiKey', sourceId: '1', name: 'Active', ownerEmail: null, status: 'Active',
          lastUsedAt: null, createdAt: null, manageRoute: '/admin/bi-api-keys' },
        { kind: 'BiApiKey', sourceId: '2', name: 'Expired-one', ownerEmail: null, status: 'Expired',
          lastUsedAt: null, createdAt: null, manageRoute: '/admin/bi-api-keys' },
        { kind: 'SystemApiKey', sourceId: '3', name: 'Revoked', ownerEmail: null, status: 'Revoked',
          lastUsedAt: null, createdAt: null, manageRoute: '/admin/system-api-keys' },
      ] satisfies IntegrationRecord[],
    });

    expect(component.expiredKeyCount()).toBe(1);
    httpMock.verify();
  });

  it('finishes loading even when one of the parallel calls fails', () => {
    const { component, httpMock } = setup();
    component.ngOnInit();
    httpMock.expectOne(usersUrl).flush([makeUser({ id: 9, roles: ['Admin'] })]);
    httpMock.expectOne((req) => req.url === auditUrl).flush({
      data: [], page: 1, pageSize: 5, totalCount: 0, totalPages: 0,
    });
    // Generic transport error on the connections endpoint — the dashboard
    // must not stay stuck in `isLoading` because of one bad card.
    httpMock.expectOne(connectionsUrl).error(new ProgressEvent('error'));
    httpMock.expectOne(scheduledTasksUrl).flush([]);
    httpMock.expectOne(storageUrl).flush([]);

    expect(component.isLoading()).toBe(false);
    // The people card still renders even though connections failed.
    expect(component.activeUserCount()).toBe(1);
    httpMock.verify();
  });

  it('compliance counts only active users with open items, and flags I-9 attention separately', () => {
    const { component, httpMock } = setup();
    component.ngOnInit();
    flushAll(httpMock, {
      users: [
        // Active, has open items, I-9 overdue → counted in both
        makeUser({ id: 1, isActive: true, missingComplianceItems: ['W-4'], i9Status: 'Section2Overdue' }),
        // Active, no open items → counted in neither
        makeUser({ id: 2, isActive: true, missingComplianceItems: [], i9Status: 'Complete' }),
        // INACTIVE with open items → must NOT count (terminated employee)
        makeUser({ id: 3, isActive: false, missingComplianceItems: ['I-9 §2'], i9Status: 'Section2Overdue' }),
        // Active, open items, I-9 status fine → counts in open but not I-9 attention
        makeUser({ id: 4, isActive: true, missingComplianceItems: ['State withholding'], i9Status: 'Complete' }),
      ],
    });

    expect(component.complianceOpenCount()).toBe(2);
    expect(component.i9AttentionCount()).toBe(1);
    httpMock.verify();
  });

  it('scheduled tasks: counts only IsActive=true and picks the soonest nextRunAt', () => {
    const { component, httpMock } = setup();
    component.ngOnInit();
    const soonest = new Date('2026-06-01T08:00:00Z');
    flushAll(httpMock, {
      scheduledTasks: [
        makeTask({ id: 1, isActive: true, nextRunAt: new Date('2026-06-15T12:00:00Z') }),
        makeTask({ id: 2, isActive: true, nextRunAt: soonest }),
        // Inactive task even though nextRunAt is earlier — must NOT count
        makeTask({ id: 3, isActive: false, nextRunAt: new Date('2026-05-31T00:00:00Z') }),
      ],
    });

    expect(component.activeScheduledTaskCount()).toBe(2);
    expect(component.nextScheduledRun()?.getTime()).toBe(soonest.getTime());
    httpMock.verify();
  });

  it('storage: totals roll up across buckets and topStorageEntity picks the largest', () => {
    const { component, httpMock } = setup();
    component.ngOnInit();
    flushAll(httpMock, {
      storage: [
        { entityType: 'Job',  fileCount: 50,  totalSizeBytes: 100 * 1024 * 1024 },     // 100 MB
        { entityType: 'Part', fileCount: 200, totalSizeBytes: 2 * 1024 * 1024 * 1024 }, // 2 GB — largest
        { entityType: 'Lead', fileCount: 10,  totalSizeBytes: 500 * 1024 },            // 500 KB
      ],
    });

    expect(component.totalFileCount()).toBe(260);
    expect(component.totalStorageDisplay()).toContain('GB');
    expect(component.topStorageEntity()?.entityType).toBe('Part');
    httpMock.verify();
  });
});
