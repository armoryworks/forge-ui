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

    expect(service.rejected()).toEqual([expect.objectContaining({
      label: { key: 'mobileAppWork.sync.action.unknown' },
      reasonKey: 'mobileAppWork.sync.reason.refused',
    })]);
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

  it('keeps the label it was queued with and gives a plain reason for a refusal', async () => {
    const label = { key: 'mobileAppWork.sync.action.advance', params: { job: 'JOB-1042' } };
    await service.enqueue('POST', '/api/v1/mobile/jobs/42/advance', { scanCode: null }, undefined, { instanceId: 'shop', label });
    await service.enqueue('POST', '/api/v1/mobile/clock/punch', {}, undefined, { instanceId: 'shop' });

    expect((await service.listPending())[0].label).toEqual(label);

    const drain = service.drain();
    (await pending('/api/v1/mobile/jobs/42/advance'))
      .flush({ title: 'Confirmation required', code: 'confirm-required' }, { status: 400, statusText: 'Bad Request' });
    (await pending('/api/v1/mobile/clock/punch')).flush({}, { status: 403, statusText: 'Forbidden' });
    await drain;

    expect(service.rejected()).toEqual([
      expect.objectContaining({ label, reasonKey: 'mobileAppWork.sync.reason.confirmRequired' }),
      expect.objectContaining({ reasonKey: 'mobileAppWork.sync.reason.forbidden' }),
    ]);
    expect(Object.keys(service.rejected()[1]).sort()).toEqual(['id', 'label', 'reasonKey', 'timestamp']);
  });
});
