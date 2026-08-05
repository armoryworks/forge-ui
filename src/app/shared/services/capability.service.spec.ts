import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { vi } from 'vitest';

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
    // The service persists a last-known snapshot to localStorage on load —
    // clear it so ETag tests never see state from another test.
    localStorage.removeItem('forge-capability-snapshot');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CapabilityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('forge-capability-snapshot');
  });

  function loadDescriptor(): void {
    service.load().subscribe();
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
    service.load().subscribe();
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

describe('CapabilityService — snapshot fallback (fail-open, 2026-08)', () => {
  const CACHE_KEY = 'forge-capability-snapshot';

  beforeEach(() => {
    localStorage.removeItem(CACHE_KEY);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => {
    localStorage.removeItem(CACHE_KEY);
    vi.restoreAllMocks();
  });

  /** Inject AFTER any localStorage seeding — the constructor hydrates the cache. */
  function inject() {
    return {
      service: TestBed.inject(CapabilityService),
      httpMock: TestBed.inject(HttpTestingController),
    };
  }

  function flushDescriptor(httpMock: HttpTestingController, capabilities: CapabilityDescriptorEntry[]): void {
    const req = httpMock.expectOne(`${environment.apiUrl}/capabilities/descriptor`);
    req.flush({
      generatedAt: '2026-08-01T00:00:00Z',
      totalCount: capabilities.length,
      enabledCount: capabilities.filter((c) => c.enabled).length,
      capabilities,
    } satisfies CapabilityDescriptor);
  }

  function failDescriptor(httpMock: HttpTestingController): void {
    const req = httpMock.expectOne(`${environment.apiUrl}/capabilities/descriptor`);
    req.flush(null, { status: 500, statusText: 'Server Error' });
  }

  it('persists a compact last-known snapshot to localStorage on successful load', () => {
    const { service, httpMock } = inject();
    service.load().subscribe();
    flushDescriptor(httpMock, [entry({ code: 'CAP-MD-CUSTOMER-CONTACTS', enabled: true, isDefaultOn: true })]);

    const cached = JSON.parse(localStorage.getItem(CACHE_KEY)!) as { generatedAt: string; enabled: Record<string, boolean> };
    expect(cached.generatedAt).toBe('2026-08-01T00:00:00Z');
    expect(cached.enabled['CAP-MD-CUSTOMER-CONTACTS']).toBe(true);
    // Compact shape only — no ETags / descriptor entries leak into storage.
    expect(Object.keys(cached)).toEqual(['generatedAt', 'enabled']);
  });

  it('keeps the previous live snapshot when a refresh fetch fails', () => {
    const { service, httpMock } = inject();
    service.load().subscribe();
    flushDescriptor(httpMock, [entry({ code: 'CAP-MD-CUSTOMER-CONTACTS', enabled: true })]);
    expect(service.isEnabled('CAP-MD-CUSTOMER-CONTACTS')).toBe(true);

    service.load().subscribe();
    failDescriptor(httpMock);

    // The good snapshot is NOT clobbered by the failed refresh.
    expect(service.descriptor()).not.toBeNull();
    expect(service.isEnabled('CAP-MD-CUSTOMER-CONTACTS')).toBe(true);
  });

  it('falls back to the cached last-known snapshot when the fetch fails with no live snapshot', () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      generatedAt: '2026-07-31T00:00:00Z',
      enabled: { 'CAP-MD-CUSTOMER-CONTACTS': true, 'CAP-MD-CUSTOMER-INTERACTIONS': false },
    }));
    const { service, httpMock } = inject();
    service.load().subscribe();
    failDescriptor(httpMock);

    expect(service.isEnabled('CAP-MD-CUSTOMER-CONTACTS')).toBe(true);
    // A cached explicit "disabled" wins over any caller-supplied default.
    expect(service.isEnabled('CAP-MD-CUSTOMER-INTERACTIONS', true)).toBe(false);
    // Degraded gating is visible in the console.
    expect(console.warn).toHaveBeenCalled();
  });

  it('honors defaultWhenUnknown when neither a live nor a cached snapshot exists, warning once per code', () => {
    const { service } = inject();

    expect(service.isEnabled('CAP-MD-CUSTOMER-CONTACTS', true)).toBe(true);
    expect(service.isEnabled('CAP-MD-CUSTOMER-CONTACTS', true)).toBe(true);
    expect(service.isEnabled('CAP-MD-CUSTOMER-INTERACTIONS')).toBe(false);

    // One warning per distinct code, not per call.
    const warned = (console.warn as unknown as ReturnType<typeof vi.fn>).mock.calls
      .filter(([msg]) => typeof msg === 'string' && msg.includes('Gating decision'));
    expect(warned.length).toBe(2);
  });

  it('clear() drops the live snapshot but keeps the cached fallback for the next session', () => {
    const { service, httpMock } = inject();
    service.load().subscribe();
    flushDescriptor(httpMock, [entry({ code: 'CAP-MD-CUSTOMER-CONTACTS', enabled: true })]);

    service.clear();

    expect(service.descriptor()).toBeNull();
    // isKnown is live-snapshot-only (the layer-3 interceptor must never
    // short-circuit off a stale cache) …
    expect(service.isKnown('CAP-MD-CUSTOMER-CONTACTS')).toBe(false);
    // … but gating decisions still serve the last-known state.
    expect(service.isEnabled('CAP-MD-CUSTOMER-CONTACTS')).toBe(true);
    expect(localStorage.getItem(CACHE_KEY)).not.toBeNull();
  });

  it('a fresh live snapshot overrides both the cache and defaults', () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      generatedAt: '2026-07-31T00:00:00Z',
      enabled: { 'CAP-MD-CUSTOMER-CONTACTS': true },
    }));
    const { service, httpMock } = inject();
    service.load().subscribe();
    flushDescriptor(httpMock, [entry({ code: 'CAP-MD-CUSTOMER-CONTACTS', enabled: false, isDefaultOn: true })]);

    // Live truth (admin turned it off) beats the cached true AND the default-on.
    expect(service.isEnabled('CAP-MD-CUSTOMER-CONTACTS', true)).toBe(false);
  });
});
