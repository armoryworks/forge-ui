import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { firstValueFrom } from 'rxjs';

import { isQueued } from '../models/mobile-api.model';
import { InstanceService } from './instance.service';
import { MobileApiService } from './mobile-api.service';
import { OfflineQueueService } from './offline-queue.service';
import { PlatformService } from './platform.service';

describe('MobileApiService', () => {
  let service: MobileApiService;
  let http: HttpTestingController;
  const enqueue = vi.fn<(...args: unknown[]) => Promise<string>>();

  beforeEach(() => {
    enqueue.mockReset().mockResolvedValue('entry-1');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PlatformService, useValue: { mobileShell: true, isNative: false, name: 'web' } },
        { provide: OfflineQueueService, useValue: { enqueue } },
        { provide: InstanceService, useValue: { instance: () => ({ id: 'shop' }) } },
      ],
    });
    service = TestBed.inject(MobileApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    http.verify();
  });

  it('sends every mutation with a fresh Idempotency-Key and client timestamp', () => {
    service.advanceJob(42, 'JOB-42').subscribe();
    service.advanceJob(42, 'JOB-42').subscribe();
    const [first, second] = http.match('/api/v1/mobile/jobs/42/advance');

    expect(first.request.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.request.headers.get('X-Client-Timestamp')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(second.request.headers.get('Idempotency-Key')).not.toBe(first.request.headers.get('Idempotency-Key'));
    expect(first.request.body).toEqual({ scanCode: 'JOB-42' });
    first.flush({}); second.flush({});
  });

  it('queues the mutation with those headers and the instance when offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    const result = await firstValueFrom(service.clockPunch('ClockIn'));

    expect(isQueued(result)).toBe(true);
    expect(enqueue).toHaveBeenCalledWith(
      'POST', '/api/v1/mobile/clock/punch', { eventType: 'ClockIn' }, 'Clock: ClockIn',
      expect.objectContaining({
        instanceId: 'shop',
        headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
      }),
    );
    http.expectNone('/api/v1/mobile/clock/punch');
  });

  it('never queues a lookup — reads stay online-only', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    service.lookup('brack').subscribe();
    http.expectOne((r) => r.url === '/api/v1/mobile/lookup').flush([]);
    expect(enqueue).not.toHaveBeenCalled();
  });
});
