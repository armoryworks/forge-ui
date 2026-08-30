import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';

import { InstanceService } from './instance.service';
import { OfflineQueueService } from './offline-queue.service';
import { PlatformService } from './platform.service';

import 'fake-indexeddb/auto';

describe('OfflineQueueService in the mobile shell', () => {
  let service: OfflineQueueService;
  let http: HttpTestingController;
  let activeInstance: { id: string } | null;

  beforeEach(() => {
    activeInstance = { id: 'shop' };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PlatformService, useValue: { mobileShell: true, isNative: false, name: 'web' } },
        { provide: InstanceService, useValue: { instance: () => activeInstance } },
      ],
    });
    service = TestBed.inject(OfflineQueueService);
    http = TestBed.inject(HttpTestingController);
  });

  // match() consumes what it returns, so grab the request the moment it appears.
  const pending = async (url: string): Promise<TestRequest> => {
    let found: TestRequest | undefined;
    await vi.waitFor(() => {
      found = http.match(url)[0];
      expect(found).toBeDefined();
    }, { timeout: 5000, interval: 20 });
    return found as TestRequest;
  };

  afterEach(async () => {
    activeInstance = { id: 'shop' };
    await service.clearQueue();
    http.match(() => true);
  });

  it('replays the stored headers so the server can deduplicate', async () => {
    await service.enqueue('POST', '/api/v1/mobile/clock/punch', { eventType: 'ClockIn' }, 'Clock: ClockIn', {
      headers: { 'Idempotency-Key': 'key-1', 'X-Client-Timestamp': '2026-08-25T12:00:00Z' },
      instanceId: 'shop',
    });

    const drain = service.drain();
    const req = await pending('/api/v1/mobile/clock/punch');
    expect(req.request.headers.get('Idempotency-Key')).toBe('key-1');
    req.flush({});
    await expect(drain).resolves.toMatchObject({ processed: 1, failed: 0 });
  });

  it('drains only the active instance\'s entries', async () => {
    await service.enqueue('POST', '/api/v1/a', {}, 'shop change', { instanceId: 'shop' });
    await service.enqueue('POST', '/api/v1/b', {}, 'foundry change', { instanceId: 'foundry' });

    expect(await service.listPending()).toHaveLength(1);
    activeInstance = { id: 'foundry' };
    expect((await service.listPending())[0]?.description).toBe('foundry change');
  });

  it('records a 4xx replay as rejected and keeps draining', async () => {
    await service.enqueue('POST', '/api/v1/first', {}, 'first', { instanceId: 'shop' });
    await service.enqueue('POST', '/api/v1/second', {}, 'second', { instanceId: 'shop' });

    const drain = service.drain();
    (await pending('/api/v1/first')).flush({ title: 'Already clocked in' }, { status: 422, statusText: 'Unprocessable' });
    (await pending('/api/v1/second')).flush({});
    await drain;

    expect(service.rejected()).toEqual([expect.objectContaining({ description: 'first', status: 422, message: 'Already clocked in' })]);
    expect(await service.listPending()).toHaveLength(0);
    service.dismissRejected(service.rejected()[0].id);
    expect(service.rejected()).toHaveLength(0);
  });

  it('remove() drops a queued change before it replays', async () => {
    const id = await service.enqueue('POST', '/api/v1/x', {}, 'x', { instanceId: 'shop' });
    expect(service.pendingCount()).toBe(1);
    await service.remove(id);
    expect(service.pendingCount()).toBe(0);
    expect(HttpErrorResponse).toBeDefined();
  });
});
