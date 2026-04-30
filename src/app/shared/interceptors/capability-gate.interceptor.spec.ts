import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CapabilityDisabledError } from '../errors/capability-disabled.error';
import { CapabilityService } from '../services/capability.service';
import { capabilityGateInterceptor } from './capability-gate.interceptor';

describe('capabilityGateInterceptor (layer-3 descriptor probe)', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let capability: CapabilityService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([capabilityGateInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    capability = TestBed.inject(CapabilityService);
  });

  afterEach(() => httpMock.verify());

  describe('short-circuit behavior', () => {
    it('blocks the HTTP request with CapabilityDisabledError when capability is known-disabled', () => {
      vi.spyOn(capability, 'isKnown').mockReturnValue(true);
      vi.spyOn(capability, 'isEnabled').mockReturnValue(false);

      let captured: unknown = null;
      http.get('/api/v1/announcements').subscribe({
        next: () => {},
        error: (err) => { captured = err; },
      });

      // Critical: no HTTP call should have fired
      httpMock.expectNone('/api/v1/announcements');

      expect(captured).toBeInstanceOf(CapabilityDisabledError);
      expect((captured as CapabilityDisabledError).capabilityCode).toBe('CAP-EXT-ANNOUNCEMENTS');
    });

    it('blocks the AI status probe when CAP-EXT-AI-ASSISTANT is disabled', () => {
      vi.spyOn(capability, 'isKnown').mockReturnValue(true);
      vi.spyOn(capability, 'isEnabled').mockReturnValue(false);

      let captured: unknown = null;
      http.get('http://localhost:5000/api/v1/ai/status').subscribe({
        next: () => {},
        error: (err) => { captured = err; },
      });

      httpMock.expectNone('http://localhost:5000/api/v1/ai/status');
      expect(captured).toBeInstanceOf(CapabilityDisabledError);
      expect((captured as CapabilityDisabledError).capabilityCode).toBe('CAP-EXT-AI-ASSISTANT');
    });

    it('blocks the planning-cycles current call when CAP-PLAN-MRP is disabled', () => {
      vi.spyOn(capability, 'isKnown').mockReturnValue(true);
      vi.spyOn(capability, 'isEnabled').mockReturnValue(false);

      let captured: unknown = null;
      http.get('/api/v1/planning-cycles/current').subscribe({
        next: () => {},
        error: (err) => { captured = err; },
      });

      httpMock.expectNone('/api/v1/planning-cycles/current');
      expect(captured).toBeInstanceOf(CapabilityDisabledError);
      expect((captured as CapabilityDisabledError).capabilityCode).toBe('CAP-PLAN-MRP');
    });
  });

  describe('pass-through behavior', () => {
    it('lets the request through when capability is known-enabled', () => {
      vi.spyOn(capability, 'isKnown').mockReturnValue(true);
      vi.spyOn(capability, 'isEnabled').mockReturnValue(true);

      http.get('/api/v1/announcements').subscribe();

      const req = httpMock.expectOne('/api/v1/announcements');
      req.flush([]);
    });

    it('lets the request through when capability is unknown (descriptor not loaded)', () => {
      vi.spyOn(capability, 'isKnown').mockReturnValue(false);

      http.get('/api/v1/announcements').subscribe();

      const req = httpMock.expectOne('/api/v1/announcements');
      req.flush([]);
    });

    it('lets non-gated URLs through regardless of descriptor state', () => {
      vi.spyOn(capability, 'isKnown').mockReturnValue(true);
      vi.spyOn(capability, 'isEnabled').mockReturnValue(false);

      http.get('/api/v1/capabilities/descriptor').subscribe();
      http.get('/api/v1/auth/login').subscribe();

      const req1 = httpMock.expectOne('/api/v1/capabilities/descriptor');
      req1.flush({});
      const req2 = httpMock.expectOne('/api/v1/auth/login');
      req2.flush({});
    });

    it('lets non-API URLs through (assets, third-party endpoints)', () => {
      vi.spyOn(capability, 'isKnown').mockReturnValue(true);
      vi.spyOn(capability, 'isEnabled').mockReturnValue(false);

      http.get('/assets/i18n/en.json').subscribe();
      const req = httpMock.expectOne('/assets/i18n/en.json');
      req.flush({});
    });
  });
});
