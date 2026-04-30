import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AnnouncementService } from './announcement.service';
import { CapabilityService } from './capability.service';
import { CapabilityDisabledError } from '../errors/capability-disabled.error';

describe('AnnouncementService', () => {
  let service: AnnouncementService;
  let httpMock: HttpTestingController;
  let capability: CapabilityService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AnnouncementService);
    httpMock = TestBed.inject(HttpTestingController);
    capability = TestBed.inject(CapabilityService);
  });

  afterEach(() => httpMock.verify());

  describe('layer-3 descriptor pre-check (Phase 4 Phase-D)', () => {
    it('does NOT fire the HTTP request when CAP-EXT-ANNOUNCEMENTS is known-disabled', () => {
      vi.spyOn(capability, 'isKnown').mockReturnValue(true);
      vi.spyOn(capability, 'isEnabled').mockReturnValue(false);

      service.loadActive();

      httpMock.expectNone('/api/v1/announcements');
      expect(service.capabilityDisabled()).toBe(true);
      expect(service.activeAnnouncements()).toEqual([]);
    });

    it('fires the HTTP request when CAP-EXT-ANNOUNCEMENTS is enabled', () => {
      vi.spyOn(capability, 'isKnown').mockReturnValue(true);
      vi.spyOn(capability, 'isEnabled').mockReturnValue(true);

      service.loadActive();

      const req = httpMock.expectOne('/api/v1/announcements');
      req.flush([]);

      expect(service.capabilityDisabled()).toBe(false);
    });

    it('fires the HTTP request when capability is unknown (boot race)', () => {
      vi.spyOn(capability, 'isKnown').mockReturnValue(false);

      service.loadActive();

      const req = httpMock.expectOne('/api/v1/announcements');
      req.flush([]);
    });
  });

  describe('layer-2 catchError safety net (Phase 4 Phase-D)', () => {
    it('sets capabilityDisabled when CapabilityDisabledError surfaces (typed error)', async () => {
      // Simulate the real-world layer-2 path: the http-error.interceptor
      // converts a 403 with the capability envelope into a typed
      // CapabilityDisabledError which surfaces in the service's `error`
      // callback. We assert the service's error handler does the right thing
      // by directly invoking it through a faked observable rather than
      // re-tracing the entire interceptor pipeline.
      vi.spyOn(capability, 'isKnown').mockReturnValue(false);
      const err = new CapabilityDisabledError('CAP-EXT-ANNOUNCEMENTS', 'disabled');
      // Spy http.get to return a stream that errors with our typed error
      const httpGetSpy = vi.spyOn((service as unknown as { http: { get: unknown } }).http, 'get');
      httpGetSpy.mockReturnValueOnce({
        subscribe: ({ error }: { error: (e: unknown) => void }) => {
          error(err);
          return { unsubscribe: () => {} };
        },
      } as never);

      service.loadActive();

      expect(service.capabilityDisabled()).toBe(true);
      expect(service.activeAnnouncements()).toEqual([]);
    });
  });
});
