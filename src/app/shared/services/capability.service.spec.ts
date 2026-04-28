import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CapabilityService } from './capability.service';
import { CapabilityDescriptor, CapabilityDescriptorEntry } from '../models/capability-descriptor.model';
import { environment } from '../../../environments/environment';

function entry(overrides: Partial<CapabilityDescriptorEntry> = {}): CapabilityDescriptorEntry {
  return {
    id: 'CAP-EXT-CHAT',
    code: 'CAP-EXT-CHAT',
    area: 'EXT',
    name: 'In-app chat',
    description: '',
    enabled: false,
    isDefaultOn: false,
    requiresRoles: null,
    version: 1,
    eTag: 'W/"1"',
    configVersion: null,
    configETag: null,
    configId: null,
    dependencies: [],
    mutexes: [],
    ...overrides,
  };
}

describe('CapabilityService — Phase 4 Phase-C ETag handling', () => {
  let service: CapabilityService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CapabilityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function loadDescriptor(): void {
    service.load();
    const req = httpMock.expectOne(`${environment.apiUrl}/capabilities/descriptor`);
    const desc: CapabilityDescriptor = {
      generatedAt: '2026-04-28T00:00:00Z',
      totalCount: 1,
      enabledCount: 0,
      capabilities: [entry()],
    };
    req.flush(desc);
  }

  it('caches the ETag from the descriptor and submits it on setEnabled', () => {
    loadDescriptor();
    expect(service.getETag('CAP-EXT-CHAT')).toBe('W/"1"');

    service.setEnabled('CAP-EXT-CHAT', true).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/capabilities/CAP-EXT-CHAT/enabled`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('If-Match')).toBe('W/"1"');
    expect(req.request.body).toEqual({ enabled: true, reason: null });

    req.flush(entry({ enabled: true, version: 2, eTag: 'W/"2"' }));

    // Local snapshot mirrors the new ETag for the next round-trip.
    expect(service.getETag('CAP-EXT-CHAT')).toBe('W/"2"');
    expect(service.isEnabled('CAP-EXT-CHAT')).toBe(true);
  });

  it('omits If-Match when no ETag is known yet', () => {
    service.setEnabled('CAP-EXT-CHAT', true).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/capabilities/CAP-EXT-CHAT/enabled`);
    expect(req.request.headers.get('If-Match')).toBeNull();
    req.flush(entry({ enabled: true }));
  });

  it('bulkToggle posts to the bulk endpoint and updates cached ETags', () => {
    loadDescriptor();
    service.bulkToggle([{ id: 'CAP-EXT-CHAT', enabled: true }]).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/capabilities/bulk-toggle`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      items: [{ id: 'CAP-EXT-CHAT', enabled: true }],
      reason: null,
    });
    req.flush([entry({ enabled: true, version: 2, eTag: 'W/"2"' })]);
    expect(service.getETag('CAP-EXT-CHAT')).toBe('W/"2"');
  });

  it('setConfig submits the config ETag separately from the toggle ETag', () => {
    service.load();
    const initialReq = httpMock.expectOne(`${environment.apiUrl}/capabilities/descriptor`);
    initialReq.flush({
      generatedAt: '2026-04-28T00:00:00Z',
      totalCount: 1,
      enabledCount: 0,
      capabilities: [entry({ configVersion: 5, configETag: 'W/"5"', configId: 99 })],
    } satisfies CapabilityDescriptor);

    service.setConfig('CAP-EXT-CHAT', '{"k":"v"}', 'reason text').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/capabilities/CAP-EXT-CHAT/config`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('If-Match')).toBe('W/"5"');
    expect(req.request.body).toEqual({ configJson: '{"k":"v"}', reason: 'reason text' });
    req.flush(entry({ configVersion: 6, configETag: 'W/"6"', configId: 99 }));

    expect(service.getConfigETag('CAP-EXT-CHAT')).toBe('W/"6"');
  });

  // ─── Phase 4 Phase-E additions ───────────────────────────────────────────

  it('getRelations fetches the per-capability dependency graph', () => {
    let received: unknown = null;
    service.getRelations('CAP-MD-CUSTOMERS').subscribe((r) => {
      received = r;
    });
    const req = httpMock.expectOne(`${environment.apiUrl}/capabilities/CAP-MD-CUSTOMERS/relations`);
    expect(req.request.method).toBe('GET');
    req.flush({
      code: 'CAP-MD-CUSTOMERS',
      dependencies: [],
      dependents: [{ code: 'CAP-O2C-QUOTE', name: 'Quote', area: 'O2C', enabled: true }],
      mutexes: [],
    });
    expect(received).toEqual({
      code: 'CAP-MD-CUSTOMERS',
      dependencies: [],
      dependents: [{ code: 'CAP-O2C-QUOTE', name: 'Quote', area: 'O2C', enabled: true }],
      mutexes: [],
    });
  });

  it('getAuditLog passes cursor and take query params', () => {
    service.getAuditLog('CAP-EXT-CHAT', { take: 10, before: '2026-04-28T00:00:00Z' }).subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/capabilities/CAP-EXT-CHAT/audit-log`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('take')).toBe('10');
    expect(req.request.params.get('before')).toBe('2026-04-28T00:00:00Z');
    req.flush([]);
  });

  it('validate posts the bulk delta and returns the violation envelope', () => {
    let result: unknown = null;
    service
      .validate([{ id: 'CAP-EXT-CHAT', enabled: true }, { id: 'CAP-ACCT-EXTERNAL', enabled: true }])
      .subscribe((r) => {
        result = r;
      });
    const req = httpMock.expectOne(`${environment.apiUrl}/capabilities/validate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      items: [
        { id: 'CAP-EXT-CHAT', enabled: true },
        { id: 'CAP-ACCT-EXTERNAL', enabled: true },
      ],
    });
    req.flush({
      valid: false,
      violations: [
        {
          code: 'capability-mutex-violation',
          capability: 'CAP-ACCT-EXTERNAL',
          message: "'CAP-ACCT-EXTERNAL' conflicts with enabled: CAP-ACCT-BUILTIN",
          conflicts: ['CAP-ACCT-BUILTIN'],
        },
      ],
    });
    expect(result).toEqual({
      valid: false,
      violations: [
        {
          code: 'capability-mutex-violation',
          capability: 'CAP-ACCT-EXTERNAL',
          message: "'CAP-ACCT-EXTERNAL' conflicts with enabled: CAP-ACCT-BUILTIN",
          conflicts: ['CAP-ACCT-BUILTIN'],
        },
      ],
    });
  });
});
