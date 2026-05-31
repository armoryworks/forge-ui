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
  activeUserCount: { (): number };
  roleBreakdown: { (): { role: string; count: number }[] };
  expiredKeyCount: { (): number };
  isLoading: { (): boolean };
}

const usersUrl = `${environment.apiUrl}/admin/users`;
const auditUrl = `${environment.apiUrl}/admin/audit-log`;
const connectionsUrl = `${environment.apiUrl}/admin/connections`;

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
    roleTemplateId: null, roleTemplateName: null, roleTemplateIncludedRoles: null,
    ...overrides,
  };
}

describe('AdminOverviewComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('counts active users only — inactive rows are excluded from the headline', () => {
    const { component, httpMock } = setup();
    component.ngOnInit();
    httpMock.expectOne(usersUrl).flush([
      makeUser({ id: 1, roles: ['Admin'], isActive: true }),
      makeUser({ id: 2, roles: ['Engineer'], isActive: true }),
      makeUser({ id: 3, roles: ['Engineer'], isActive: false }),
    ]);
    httpMock.expectOne((req) => req.url === auditUrl).flush({
      data: [], page: 1, pageSize: 5, totalCount: 0, totalPages: 0,
    });
    httpMock.expectOne(connectionsUrl).flush([]);

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
    httpMock.expectOne(usersUrl).flush([]);
    httpMock.expectOne((req) => req.url === auditUrl).flush({
      data: [], page: 1, pageSize: 5, totalCount: 0, totalPages: 0,
    });
    httpMock.expectOne(connectionsUrl).flush([
      { kind: 'BiApiKey', sourceId: '1', name: 'Active', ownerEmail: null, status: 'Active',
        lastUsedAt: null, createdAt: null, manageRoute: '/admin/bi-api-keys' },
      { kind: 'BiApiKey', sourceId: '2', name: 'Expired-one', ownerEmail: null, status: 'Expired',
        lastUsedAt: null, createdAt: null, manageRoute: '/admin/bi-api-keys' },
      { kind: 'SystemApiKey', sourceId: '3', name: 'Revoked', ownerEmail: null, status: 'Revoked',
        lastUsedAt: null, createdAt: null, manageRoute: '/admin/system-api-keys' },
    ] satisfies IntegrationRecord[]);

    expect(component.expiredKeyCount()).toBe(1);
    httpMock.verify();
  });

  it('finishes loading even when one of the three parallel calls fails', () => {
    const { component, httpMock } = setup();
    component.ngOnInit();
    httpMock.expectOne(usersUrl).flush([makeUser({ id: 9, roles: ['Admin'] })]);
    httpMock.expectOne((req) => req.url === auditUrl).flush({
      data: [], page: 1, pageSize: 5, totalCount: 0, totalPages: 0,
    });
    // Generic transport error on the connections endpoint — the dashboard
    // must not stay stuck in `isLoading` because of one bad card.
    httpMock.expectOne(connectionsUrl).error(new ProgressEvent('error'));

    expect(component.isLoading()).toBe(false);
    // The people card still renders even though connections failed.
    expect(component.activeUserCount()).toBe(1);
    httpMock.verify();
  });
});
