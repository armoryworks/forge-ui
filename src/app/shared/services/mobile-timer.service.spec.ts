import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { Subject, of, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { ActiveTimer } from '../models/mobile-api.model';
import { AuthService } from './auth.service';
import { MobileApiService } from './mobile-api.service';
import { MobileTimerService } from './mobile-timer.service';
import { OfflineQueueService } from './offline-queue.service';

function running(jobId: number, jobNumber: string, timeEntryId = 3): ActiveTimer {
  return { timeEntryId, jobId, jobNumber, operationId: null, timerStart: new Date('2026-10-07T10:00:00Z') };
}

describe('MobileTimerService', () => {
  let service: MobileTimerService;
  let authenticated: boolean;
  const api = {
    activeTimer: vi.fn(),
    startTimer: vi.fn(),
    stopTimer: vi.fn(),
    deleteTimeEntry: vi.fn(),
  };
  const remove = vi.fn();
  const open = vi.fn();
  const instant = vi.fn((key: string) => key);

  beforeEach(() => {
    authenticated = true;
    api.activeTimer.mockReset().mockReturnValue(of(null));
    api.startTimer.mockReset().mockReturnValue(
      of({ id: 11, jobId: 42, jobNumber: 'JOB-42', timerStart: new Date('2026-10-07T11:00:00Z') }));
    api.stopTimer.mockReset().mockReturnValue(of({}));
    api.deleteTimeEntry.mockReset().mockReturnValue(of(null));
    remove.mockReset().mockResolvedValue(undefined);
    open.mockReset().mockReturnValue({ afterClosed: () => of(true) });
    instant.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: MobileApiService, useValue: api },
        { provide: AuthService, useValue: { isAuthenticated: () => authenticated } },
        { provide: OfflineQueueService, useValue: { remove } },
        { provide: MatDialog, useValue: { open } },
        { provide: TranslateService, useValue: { instant } },
      ],
    });
    service = TestBed.inject(MobileTimerService);
  });

  it('loads the running timer, and shows none without a session', async () => {
    api.activeTimer.mockReturnValue(of(running(42, 'JOB-42')));
    await service.refresh();
    expect(service.active()?.jobNumber).toBe('JOB-42');
    expect(service.runningOn(42)).toBe(true);
    expect(service.runningOn(7)).toBe(false);

    authenticated = false;
    await service.refresh();
    expect(service.active()).toBeNull();
  });

  it('keeps the last known timer when the lookup fails', async () => {
    api.activeTimer.mockReturnValue(of(running(42, 'JOB-42')));
    await service.refresh();
    api.activeTimer.mockReturnValue(throwError(() => new Error('offline')));
    await service.refresh();
    expect(service.active()?.jobId).toBe(42);
  });

  it('starts without asking when nothing is running and returns the entry id', async () => {
    const outcome = await service.toggle(42, 'JOB-42');

    expect(open).not.toHaveBeenCalled();
    expect(api.stopTimer).not.toHaveBeenCalled();
    expect(outcome).toEqual({ started: { entryId: 11, queuedIds: [], previous: null } });
    expect(service.active()).toEqual(expect.objectContaining({ timeEntryId: 11, jobId: 42, jobNumber: 'JOB-42' }));
  });

  it('asks before switching, then stops the running timer and starts the new one', async () => {
    api.activeTimer.mockReturnValue(of(running(7, 'JOB-7')));

    const outcome = await service.toggle(42, 'JOB-42');

    expect(instant).toHaveBeenCalledWith('mobileApp.timer.switchConfirm', { current: 'JOB-7', next: 'JOB-42' });
    expect(api.stopTimer).toHaveBeenCalledOnce();
    expect(api.startTimer).toHaveBeenCalledWith(42);
    expect(api.stopTimer.mock.invocationCallOrder[0]).toBeLessThan(api.startTimer.mock.invocationCallOrder[0]);
    expect(outcome).toEqual({ started: { entryId: 11, queuedIds: [], previous: running(7, 'JOB-7') } });
    expect(service.active()?.jobId).toBe(42);
  });

  it('reads the server before deciding, so a person who just identified gets the switch prompt', async () => {
    expect(service.active()).toBeNull();
    api.activeTimer.mockReturnValue(of(running(7, 'JOB-7')));

    await service.toggle(42, 'JOB-42');

    expect(api.activeTimer).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();
    expect(api.stopTimer).toHaveBeenCalledOnce();
    expect(api.startTimer).toHaveBeenCalledWith(42);
  });

  it('leaves the timer running when the server says it already runs on that job', async () => {
    expect(service.active()).toBeNull();
    api.activeTimer.mockReturnValue(of(running(42, 'JOB-42')));

    const outcome = await service.toggle(42, 'JOB-42');

    expect(open).not.toHaveBeenCalled();
    expect(api.startTimer).not.toHaveBeenCalled();
    expect(api.stopTimer).not.toHaveBeenCalled();
    expect(outcome).toEqual({ alreadyRunning: running(42, 'JOB-42') });
    expect(service.active()?.jobId).toBe(42);
  });

  it('describes a running timer with its job and elapsed time', () => {
    const timer = running(42, 'JOB-42');
    expect(service.elapsedOf(timer, new Date('2026-10-07T11:02:05Z').getTime())).toBe('1:02:05');

    service.runningMessage(timer);

    expect(instant).toHaveBeenLastCalledWith('mobileApp.timer.running', { jobNumber: 'JOB-42', elapsed: expect.any(String) });
  });

  it('uses the server answer even when an older refresh is still in flight', async () => {
    const pending = new Subject<ActiveTimer | null>();
    api.activeTimer.mockReturnValueOnce(pending).mockReturnValue(of(running(7, 'JOB-7')));
    const stale = service.refresh();

    await service.toggle(42, 'JOB-42');
    pending.next(null);
    pending.complete();
    await stale;

    expect(open).toHaveBeenCalledOnce();
    expect(service.active()?.jobId).toBe(42);
  });

  it('changes nothing when the person declines to switch', async () => {
    api.activeTimer.mockReturnValue(of(running(7, 'JOB-7')));
    open.mockReturnValue({ afterClosed: () => of(false) });

    const outcome = await service.toggle(42, 'JOB-42');

    expect(outcome).toBeNull();
    expect(api.stopTimer).not.toHaveBeenCalled();
    expect(api.startTimer).not.toHaveBeenCalled();
    expect(service.active()?.jobId).toBe(7);
  });

  it('names a timer with no job in the switch prompt', async () => {
    api.activeTimer.mockReturnValue(of({ ...running(7, 'JOB-7'), jobId: null, jobNumber: null }));

    await service.toggle(42, 'JOB-42');

    expect(instant).toHaveBeenCalledWith('mobileApp.timer.switchConfirm', { current: 'timeTracking.timer', next: 'JOB-42' });
  });

  it('keeps showing the old timer when a switch is only queued offline', async () => {
    api.activeTimer.mockReturnValue(of(running(7, 'JOB-7')));
    api.stopTimer.mockReturnValue(of({ queued: true, entryId: 'q-stop' }));
    api.startTimer.mockReturnValue(of({ queued: true, entryId: 'q-start' }));

    expect(await service.toggle(42, 'JOB-42'))
      .toEqual({ started: { entryId: null, queuedIds: ['q-stop', 'q-start'], previous: running(7, 'JOB-7') } });
    expect(service.active()?.jobId).toBe(7);
  });

  it('undoes a start by deleting the entry, not by stopping it', async () => {
    await service.toggle(42, 'JOB-42');

    await service.undoStart(11, null, 'person-token');

    expect(api.deleteTimeEntry).toHaveBeenCalledWith(11, 'person-token');
    expect(api.stopTimer).not.toHaveBeenCalled();
    expect(api.startTimer).toHaveBeenCalledOnce();
    expect(service.active()).toBeNull();
  });

  it('falls back to stopping when the delete is refused', async () => {
    api.deleteTimeEntry.mockReturnValue(throwError(() => new Error('409')));

    await service.undoStart(11, null, 'person-token');

    expect(api.stopTimer).toHaveBeenCalledWith('person-token');
  });

  it('undoing a switch puts the timer back on the previous job', async () => {
    api.activeTimer.mockReturnValue(of(running(7, 'JOB-7')));
    await service.toggle(42, 'JOB-42');
    api.startTimer.mockClear().mockReturnValue(of({ id: 12, jobId: 7, jobNumber: 'JOB-7', timerStart: new Date() }));
    api.activeTimer.mockReturnValue(of(running(7, 'JOB-7', 12)));

    await service.undoStart(11, running(7, 'JOB-7'), 'person-token');

    expect(api.deleteTimeEntry).toHaveBeenCalledWith(11, 'person-token');
    expect(api.startTimer).toHaveBeenCalledWith(7, 'person-token', null);
    expect(api.deleteTimeEntry.mock.invocationCallOrder[0]).toBeLessThan(api.startTimer.mock.invocationCallOrder[0]);
    expect(service.active()?.timeEntryId).toBe(12);
  });

  it('undoing a switch restores the previous operation, and a timer with no job', async () => {
    const onOperation = { ...running(7, 'JOB-7'), operationId: 5 };
    await service.undoStart(11, onOperation, 'person-token');
    expect(api.startTimer).toHaveBeenLastCalledWith(7, 'person-token', 5);

    const indirect = { ...running(7, 'JOB-7'), jobId: null, jobNumber: null };
    await service.undoStart(11, indirect, 'person-token');
    expect(api.startTimer).toHaveBeenLastCalledWith(null, 'person-token', null);
  });

  it('says which job a stop ended, or that a timer with no job stopped', () => {
    expect(service.stoppedMessage(running(42, 'JOB-42'))).toBe('mobileApp.timer.stopped');
    expect(instant).toHaveBeenLastCalledWith('mobileApp.timer.stopped', { jobNumber: 'JOB-42' });
    expect(service.stoppedMessage({ ...running(7, 'JOB-7'), jobId: null, jobNumber: null })).toBe('timeTracking.timerStopped');
  });

  it('stop ends the timer and returns what was running', async () => {
    api.activeTimer.mockReturnValue(of(running(42, 'JOB-42')));
    await service.refresh();

    const outcome = await service.stop();

    expect(outcome).toEqual({ stopped: running(42, 'JOB-42'), queuedId: null });
    expect(service.active()).toBeNull();
  });

  it('reloads the timer when a stop fails, so a timer that ended elsewhere disappears', async () => {
    api.activeTimer.mockReturnValue(of(running(42, 'JOB-42')));
    await service.refresh();
    api.stopTimer.mockReturnValue(throwError(() => new Error('400')));
    api.activeTimer.mockReturnValue(of(null));

    await expect(service.stop()).rejects.toThrow('400');

    expect(service.active()).toBeNull();
  });

  it('undoing a stop starts the same job and operation again as the same person', async () => {
    const onOperation = { ...running(42, 'JOB-42'), operationId: 5 };
    api.activeTimer.mockReturnValue(of(onOperation));
    await service.refresh();
    const outcome = await service.stop();
    api.activeTimer.mockReturnValue(of({ ...onOperation, timeEntryId: 12 }));

    await service.undoStop(outcome, 'person-token');

    expect(api.startTimer).toHaveBeenCalledWith(42, 'person-token', 5);
    expect(service.active()?.timeEntryId).toBe(12);
  });

  it('undoing a stop queued offline drops it and shows the timer again', async () => {
    api.activeTimer.mockReturnValue(of(running(42, 'JOB-42')));
    await service.refresh();
    api.stopTimer.mockReturnValue(of({ queued: true, entryId: 'q-stop' }));
    const outcome = await service.stop();
    expect(outcome.queuedId).toBe('q-stop');
    expect(service.active()).toBeNull();

    await service.undoStop(outcome);

    expect(remove).toHaveBeenCalledWith('q-stop');
    expect(api.startTimer).not.toHaveBeenCalled();
    expect(service.active()?.jobId).toBe(42);
  });
});
