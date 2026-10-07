import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { of, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { ActiveTimer } from '../models/mobile-api.model';
import { AuthService } from './auth.service';
import { MobileApiService } from './mobile-api.service';
import { MobileTimerService } from './mobile-timer.service';

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
  const open = vi.fn();
  const instant = vi.fn((key: string) => key);

  beforeEach(() => {
    authenticated = true;
    api.activeTimer.mockReset().mockReturnValue(of(null));
    api.startTimer.mockReset().mockReturnValue(
      of({ id: 11, jobId: 42, jobNumber: 'JOB-42', timerStart: new Date('2026-10-07T11:00:00Z') }));
    api.stopTimer.mockReset().mockReturnValue(of({}));
    api.deleteTimeEntry.mockReset().mockReturnValue(of(null));
    open.mockReset().mockReturnValue({ afterClosed: () => of(true) });
    instant.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: MobileApiService, useValue: api },
        { provide: AuthService, useValue: { isAuthenticated: () => authenticated } },
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
    const outcome = await service.start(42, 'JOB-42');

    expect(open).not.toHaveBeenCalled();
    expect(api.stopTimer).not.toHaveBeenCalled();
    expect(outcome).toEqual({ entryId: 11, queuedIds: [] });
    expect(service.active()).toEqual(expect.objectContaining({ timeEntryId: 11, jobId: 42, jobNumber: 'JOB-42' }));
  });

  it('asks before switching, then stops the running timer and starts the new one', async () => {
    api.activeTimer.mockReturnValue(of(running(7, 'JOB-7')));
    await service.refresh();

    const outcome = await service.start(42, 'JOB-42');

    expect(instant).toHaveBeenCalledWith('mobileApp.timer.switchConfirm', { current: 'JOB-7', next: 'JOB-42' });
    expect(api.stopTimer).toHaveBeenCalledOnce();
    expect(api.startTimer).toHaveBeenCalledWith(42);
    expect(api.stopTimer.mock.invocationCallOrder[0]).toBeLessThan(api.startTimer.mock.invocationCallOrder[0]);
    expect(outcome?.entryId).toBe(11);
    expect(service.active()?.jobId).toBe(42);
  });

  it('changes nothing when the person declines to switch', async () => {
    api.activeTimer.mockReturnValue(of(running(7, 'JOB-7')));
    await service.refresh();
    open.mockReturnValue({ afterClosed: () => of(false) });

    const outcome = await service.start(42, 'JOB-42');

    expect(outcome).toBeNull();
    expect(api.stopTimer).not.toHaveBeenCalled();
    expect(api.startTimer).not.toHaveBeenCalled();
    expect(service.active()?.jobId).toBe(7);
  });

  it('reports both queue entries when a switch is queued offline', async () => {
    api.activeTimer.mockReturnValue(of(running(7, 'JOB-7')));
    await service.refresh();
    api.stopTimer.mockReturnValue(of({ queued: true, entryId: 'q-stop' }));
    api.startTimer.mockReturnValue(of({ queued: true, entryId: 'q-start' }));

    expect(await service.start(42, 'JOB-42')).toEqual({ entryId: null, queuedIds: ['q-stop', 'q-start'] });
  });

  it('undoes a start by deleting the entry, not by stopping it', async () => {
    await service.start(42, 'JOB-42');

    await service.undoStart(11, 'person-token');

    expect(api.deleteTimeEntry).toHaveBeenCalledWith(11, 'person-token');
    expect(api.stopTimer).not.toHaveBeenCalled();
    expect(service.active()).toBeNull();
  });

  it('falls back to stopping when the delete is refused', async () => {
    api.deleteTimeEntry.mockReturnValue(throwError(() => new Error('403')));

    await service.undoStart(11, 'person-token');

    expect(api.stopTimer).toHaveBeenCalledWith('person-token');
  });

  it('stop ends the timer and returns what was running', async () => {
    api.activeTimer.mockReturnValue(of(running(42, 'JOB-42')));
    await service.refresh();

    const stopped = await service.stop();

    expect(stopped?.jobNumber).toBe('JOB-42');
    expect(service.active()).toBeNull();
  });
});
