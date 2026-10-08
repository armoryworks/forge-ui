import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { firstValueFrom } from 'rxjs';

import { SILENT_HTTP_ERRORS } from '../interceptors/silent-http-errors.token';
import { isQueued } from '../models/mobile-api.model';
import { InstanceService } from './instance.service';
import { MobileApiService } from './mobile-api.service';
import { OfflineQueueService } from './offline-queue.service';
import { PlatformService } from './platform.service';

describe('MobileApiService', () => {
  let service: MobileApiService;
  let http: HttpTestingController;
  const enqueue = vi.fn<(...args: unknown[]) => Promise<string>>();
  let instanceId: string;

  beforeEach(() => {
    enqueue.mockReset().mockResolvedValue('entry-1');
    instanceId = 'shop';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PlatformService, useValue: { mobileShell: true, isNative: false, name: 'web' } },
        { provide: OfflineQueueService, useValue: { enqueue } },
        { provide: InstanceService, useValue: { instance: () => ({ id: instanceId }) } },
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
      'POST', '/api/v1/mobile/clock/punch', { eventType: 'ClockIn' }, undefined,
      expect.objectContaining({
        instanceId: 'shop',
        headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
        label: { key: 'mobileAppWork.sync.action.clock.ClockIn' },
      }),
    );
    http.expectNone('/api/v1/mobile/clock/punch');
  });

  it('reads the running timer and treats 204 as none running', async () => {
    const running = firstValueFrom(service.activeTimer());
    const req = http.expectOne('/api/v1/time-tracking/timer/active');
    expect(req.request.context.get(SILENT_HTTP_ERRORS)).toBe(true);
    req
      .flush({ timeEntryId: 9, jobId: 42, jobNumber: 'JOB-42', operationId: null, timerStart: '2026-10-07T10:00:00Z' });
    expect((await running)?.timeEntryId).toBe(9);

    const none = firstValueFrom(service.activeTimer());
    http.expectOne('/api/v1/time-tracking/timer/active').flush(null, { status: 204, statusText: 'No Content' });
    expect(await none).toBeNull();
  });

  it('deletes a time entry by id, keeping a refusal off the global error surface', () => {
    service.deleteTimeEntry(9).subscribe();
    const req = http.expectOne('/api/v1/time-tracking/entries/9');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.context.get(SILENT_HTTP_ERRORS)).toBe(true);
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('restarts a timer as the given person and leaves other errors visible', () => {
    service.startTimer(7, 'person-token').subscribe();
    const req = http.expectOne('/api/v1/time-tracking/timer/start');
    expect(req.request.headers.get('Authorization')).toBe('Bearer person-token');
    expect(req.request.body).toEqual({ jobId: 7, operationId: null });
    expect(req.request.context.get(SILENT_HTTP_ERRORS)).toBe(false);
    req.flush({ id: 12 });
  });

  it('restarts a timer on its operation, or with no job', () => {
    service.startTimer(7, 'person-token', 5).subscribe();
    expect(http.expectOne('/api/v1/time-tracking/timer/start').request.body).toEqual({ jobId: 7, operationId: 5 });

    service.startTimer(null, 'person-token').subscribe();
    expect(http.expectOne('/api/v1/time-tracking/timer/start').request.body).toEqual({ jobId: null, operationId: null });
  });

  it('sends a punch undo with the given token and never queues it offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    service.undoClockPunch(77, 'person-token').subscribe({ error: () => undefined });

    const req = http.expectOne('/api/v1/mobile/clock/events/77');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.headers.get('Authorization')).toBe('Bearer person-token');
    expect(req.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(req.request.context.get(SILENT_HTTP_ERRORS)).toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
    req.flush({ state: 'out', lastEventType: null, lastEventAt: null, lastEventId: null });
  });

  it('keeps a punch undo refusal off the global error surface when asked', () => {
    service.undoClockPunch(77, 'person-token', true).subscribe({ error: () => undefined });

    const req = http.expectOne('/api/v1/mobile/clock/events/77');
    expect(req.request.context.get(SILENT_HTTP_ERRORS)).toBe(true);
    req.flush({ state: 'out', lastEventType: null, lastEventAt: null, lastEventId: null });
  });

  it('keeps a clock state refusal off the global error surface when asked', () => {
    service.clockState(true).subscribe({ error: () => undefined });
    service.clockState().subscribe({ error: () => undefined });

    const [silent, loud] = http.match('/api/v1/mobile/clock/state');
    expect(silent.request.context.get(SILENT_HTTP_ERRORS)).toBe(true);
    expect(loud.request.context.get(SILENT_HTTP_ERRORS)).toBe(false);
    silent.flush({ state: 'out', lastEventType: null, lastEventAt: null, lastEventId: null });
    loud.flush({ state: 'out', lastEventType: null, lastEventAt: null, lastEventId: null });
  });

  it('never queues a lookup — reads stay online-only', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    service.lookup('brack').subscribe();
    http.expectOne((r) => r.url === '/api/v1/mobile/lookup').flush([]);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('stops with an empty body unless a target is named', () => {
    service.stopTimer().subscribe();
    expect(http.expectOne('/api/v1/time-tracking/timer/stop').request.body).toEqual({});

    service.stopTimer('person-token', { timeEntryId: 31 }).subscribe();
    const named = http.expectOne('/api/v1/time-tracking/timer/stop');
    expect(named.request.body).toEqual({ timeEntryId: 31 });
    expect(named.request.headers.get('Authorization')).toBe('Bearer person-token');

    service.stopTimer(undefined, { jobId: 42 }).subscribe();
    expect(http.expectOne('/api/v1/time-tracking/timer/stop').request.body).toEqual({ jobId: 42 });
  });

  it('reads the setting, the open timers and the operations quietly, and never queues them', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    service.operationsConfig().subscribe();
    service.activeTimers().subscribe();
    service.jobOperations(42).subscribe();

    for (const url of ['/api/v1/job-operations/config', '/api/v1/time-tracking/timers/active', '/api/v1/jobs/42/operations']) {
      const req = http.expectOne(url);
      expect(req.request.method).toBe('GET');
      expect(req.request.context.get(SILENT_HTTP_ERRORS)).toBe(true);
      req.flush({});
    }
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('starts, stops and updates an operation with idempotency keys', () => {
    service.startOperationTimer(42, 20).subscribe();
    const start = http.expectOne('/api/v1/jobs/42/operations/20/timer/start');
    expect(start.request.method).toBe('POST');
    expect(start.request.body).toEqual({ entryType: 'Run' });
    expect(start.request.headers.get('Idempotency-Key')).toBeTruthy();
    start.flush({});

    service.startOperationTimer(42, 20, 'Setup', 'person-token').subscribe();
    const setup = http.expectOne('/api/v1/jobs/42/operations/20/timer/start');
    expect(setup.request.body).toEqual({ entryType: 'Setup' });
    expect(setup.request.headers.get('Authorization')).toBe('Bearer person-token');
    setup.flush({});

    service.stopOperationTimer(42, 20).subscribe();
    const stop = http.expectOne('/api/v1/jobs/42/operations/20/timer/stop');
    expect(stop.request.body).toEqual({});
    stop.flush({});

    service.updateOperationProgress(42, 20, { completedQuantity: 39, scrapQuantity: 1, status: 'Complete', expectedVersion: 3 }).subscribe();
    const patch = http.expectOne('/api/v1/jobs/42/operations/20');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ completedQuantity: 39, scrapQuantity: 1, status: 'Complete', expectedVersion: 3 });
    expect(patch.request.context.get(SILENT_HTTP_ERRORS)).toBe(true);
    patch.flush({});
  });

  it('queues operation changes offline like any other mutation', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    const result = await firstValueFrom(service.updateOperationProgress(42, 20, { completedQuantity: 5 }));

    expect(isQueued(result)).toBe(true);
    expect(enqueue).toHaveBeenCalledWith(
      'PATCH', '/api/v1/jobs/42/operations/20', { completedQuantity: 5 }, undefined,
      expect.objectContaining({ label: { key: 'mobileAppWork.sync.action.updateOperationAny' } }));
  });

  it('sends the advance, start and stop bodies it always sent when no operation or confirmation is named', () => {
    service.advanceJob(42, 'JOB-42').subscribe();
    const advance = http.expectOne('/api/v1/mobile/jobs/42/advance');
    expect(advance.request.method).toBe('POST');
    expect(advance.request.body).toEqual({ scanCode: 'JOB-42' });
    advance.flush({});

    service.startTimer(42).subscribe();
    const start = http.expectOne('/api/v1/time-tracking/timer/start');
    expect(start.request.body).toEqual({ jobId: 42, operationId: null });
    start.flush({ id: 1 });

    service.stopTimer().subscribe();
    const stop = http.expectOne('/api/v1/time-tracking/timer/stop');
    expect(stop.request.body).toEqual({});
    stop.flush({});
  });

  it('sends confirmed with the status the person confirmed, and only on a confirmed advance', () => {
    service.advanceJob(42, null, 6).subscribe();
    const req = http.expectOne('/api/v1/mobile/jobs/42/advance');
    expect(req.request.body).toEqual({ scanCode: null, confirmed: true, confirmedStageId: 6 });
    req.flush({});
  });

  it('queues a confirmed advance with the confirmed status, so a later replay cannot carry it elsewhere', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    const result = await firstValueFrom(service.advanceJob(42, 'JOB-42', 6, true));

    expect(isQueued(result)).toBe(true);
    expect(enqueue).toHaveBeenCalledWith(
      'POST', '/api/v1/mobile/jobs/42/advance', { scanCode: 'JOB-42', confirmed: true, confirmedStageId: 6 }, undefined,
      expect.any(Object));
  });

  it('keeps a silent advance off the global error surface and leaves others visible', () => {
    service.advanceJob(42, 'JOB-42', null, true).subscribe({ error: () => undefined });
    const silent = http.expectOne('/api/v1/mobile/jobs/42/advance');
    expect(silent.request.context.get(SILENT_HTTP_ERRORS)).toBe(true);
    expect(silent.request.body).toEqual({ scanCode: 'JOB-42' });
    silent.flush({});

    service.advanceJob(42, 'JOB-42', 6).subscribe();
    const visible = http.expectOne('/api/v1/mobile/jobs/42/advance');
    expect(visible.request.context.get(SILENT_HTTP_ERRORS)).toBe(false);
    visible.flush({});
  });

  it('reads the caller\'s work orders', async () => {
    const mine = firstValueFrom(service.myJobs());
    http.expectOne('/api/v1/mobile/jobs/mine').flush([{ id: 42, jobNumber: 'JOB-42' }]);
    expect(await mine).toEqual([{ id: 42, jobNumber: 'JOB-42' }]);
  });

  it('names a queued job change by the job number it last read, never the id', async () => {
    service.jobStatus(42).subscribe();
    http.expectOne('/api/v1/mobile/jobs/42/status').flush({ id: 42, jobNumber: 'JOB-1042' });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    await firstValueFrom(service.advanceJob(42, null));
    await firstValueFrom(service.addNote(7, 'Checked'));

    expect(enqueue.mock.calls[0][4]).toMatchObject({
      label: { key: 'mobileAppWork.sync.action.advance', params: { job: 'JOB-1042' } },
    });
    expect(enqueue.mock.calls[1][4]).toMatchObject({ label: { key: 'mobileAppWork.sync.action.addNoteAny' } });
  });

  it('never names a queued change by a number read on another instance', async () => {
    service.jobStatus(42).subscribe();
    http.expectOne('/api/v1/mobile/jobs/42/status').flush({ id: 42, jobNumber: 'JOB-1042' });
    instanceId = 'other-shop';
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    await firstValueFrom(service.advanceJob(42, null));

    expect(enqueue.mock.calls[0][4]).toMatchObject({ label: { key: 'mobileAppWork.sync.action.advanceAny' } });
  });

  it('names a queued stock move by the part number it last read', async () => {
    service.resolveScan('PRT-9').subscribe();
    http.expectOne('/api/v1/mobile/scan/resolve')
      .flush({ kind: 'part', id: 9, code: 'PRT-9', label: 'BRKT-100', subtitle: null });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    await firstValueFrom(service.moveStock({ partId: 9, fromLocationId: 1, toLocationId: 2, quantity: 5, lotNumber: null }));

    expect(enqueue.mock.calls[0][4]).toMatchObject({
      label: { key: 'mobileAppWork.sync.action.moveStock', params: { quantity: 5, part: 'BRKT-100' } },
    });
  });
});
