import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { ConnectionsPanelComponent } from './connections-panel.component';
import { IntegrationRecord } from '../../models/integration-record.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface PanelInternals {
  load(): void;
  manage(row: IntegrationRecord): void;
  statusChipClass(status: string): string;
  rows: { (): IntegrationRecord[] };
  count: { (): number };
  isLoading: { (): boolean };
}

const base = `${environment.apiUrl}/admin/connections`;

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
  const component = TestBed.runInInjectionContext(() => new ConnectionsPanelComponent());
  const httpMock = TestBed.inject(HttpTestingController);
  const router = TestBed.inject(Router) as unknown as { navigateByUrl: ReturnType<typeof vi.fn> };
  return { component: component as unknown as PanelInternals, httpMock, router };
}

function makeRow(overrides: Partial<IntegrationRecord> = {}): IntegrationRecord {
  return {
    kind: 'BiApiKey',
    sourceId: '1',
    name: 'Looker',
    ownerEmail: null,
    status: 'Active',
    lastUsedAt: null,
    createdAt: '2026-05-30T00:00:00Z',
    manageRoute: '/admin/bi-api-keys',
    ...overrides,
  };
}

describe('ConnectionsPanelComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('GETs /admin/connections on load() and populates the rows signal', () => {
    const { component, httpMock } = setup();
    const fixture: IntegrationRecord[] = [
      makeRow({ kind: 'SystemApiKey', name: 'Tuyere', ownerEmail: 'tuyere@forge.local', manageRoute: '/admin/system-api-keys' }),
      makeRow({ kind: 'QuickBooksOAuth', name: 'QuickBooks Online', status: 'Connected', manageRoute: '/admin/integrations' }),
    ];
    component.load();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush(fixture);
    expect(component.rows()).toHaveLength(2);
    expect(component.count()).toBe(2);
    expect(component.isLoading()).toBe(false);
    httpMock.verify();
  });

  it('maps each native status vocabulary onto the shared chip palette', () => {
    const { component } = setup();
    // Active/Connected/Linked share the success palette.
    expect(component.statusChipClass('Active')).toBe('chip--success');
    expect(component.statusChipClass('Connected')).toBe('chip--success');
    expect(component.statusChipClass('Linked')).toBe('chip--success');
    // Expired flags as warning — the row is still IsActive=true but unusable.
    expect(component.statusChipClass('Expired')).toBe('chip--warning');
    // Revoked / Disconnected / Inactive fall through to neutral so they
    // recede visually next to the live rows.
    expect(component.statusChipClass('Revoked')).toBe('chip--neutral');
    expect(component.statusChipClass('Disconnected')).toBe('chip--neutral');
    expect(component.statusChipClass('Inactive')).toBe('chip--neutral');
    // Unknown vocab also lands on neutral rather than throwing.
    expect(component.statusChipClass('SomeNewStatus')).toBe('chip--neutral');
  });

  it('manage() navigates to the row\'s native manage-route — the registry never mutates', () => {
    const { component, router } = setup();
    const row = makeRow({ kind: 'EdiTradingPartner', name: 'Acme', manageRoute: '/admin/edi' });
    component.manage(row);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/edi');
  });
});
