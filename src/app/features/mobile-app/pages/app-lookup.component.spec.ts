import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

import { of, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { ScanResolveResult } from '../../../shared/models/mobile-api.model';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
import { MobileMoveConfirmService } from '../../../shared/services/mobile-move-confirm.service';
import { MobileTimerService } from '../../../shared/services/mobile-timer.service';
import { OfflineQueueService } from '../../../shared/services/offline-queue.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { UndoService } from '../../../shared/services/undo.service';
import { ScanAction } from '../components/scan-action-sheet/scan-action-sheet.component';
import { AppLookupComponent } from './app-lookup.component';

interface LookupInternals {
  selected: WritableSignal<ScanResolveResult | null>;
  onAction(action: ScanAction): Promise<void>;
}

const job: ScanResolveResult = { kind: 'job', id: 42, code: 'JOB-42', label: 'JOB-42', subtitle: null };
const moved = { status: { stageName: 'Invoiced' }, previousStageId: 5, previousStageName: 'Shipped', collapsed: false };

describe('AppLookupComponent moving a job', () => {
  const refusal = { code: 'confirm-required' };
  const api = {
    lookup: vi.fn(() => of([])),
    advanceJob: vi.fn(),
    jobStatus: vi.fn(),
    moveJobToStage: vi.fn(),
    stopTimer: vi.fn(),
  };
  const confirmMove = {
    needed: vi.fn(),
    ask: vi.fn(),
    isConfirmRequired: vi.fn((err: unknown) => err === refusal),
    failureMessage: vi.fn((_err: unknown) => 'mobileApp.jobs.actionFailed'),
  };
  const timer = { active: signal(null), refresh: vi.fn() };
  const offer = vi.fn();
  const snackbar = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

  function create(): LookupInternals {
    const component = TestBed.runInInjectionContext(() => new AppLookupComponent()) as unknown as LookupInternals;
    component.selected.set(job);
    return component;
  }

  function refuseUnconfirmed(): void {
    api.advanceJob.mockImplementation((_id: number, _code: null, confirmedStageId: number | null) => confirmedStageId !== null
      ? of(moved)
      : throwError(() => refusal));
  }

  beforeEach(() => {
    api.advanceJob.mockReset().mockReturnValue(of({ ...moved, status: { stageName: 'Machining' } }));
    api.jobStatus.mockReset().mockReturnValue(of({ id: 42, nextStageId: 6, nextStageName: 'Invoiced' }));
    api.moveJobToStage.mockReset().mockReturnValue(of({}));
    api.stopTimer.mockReset().mockReturnValue(of({}));
    confirmMove.needed.mockReset().mockReturnValue(true);
    confirmMove.ask.mockReset().mockResolvedValue(true);
    confirmMove.failureMessage.mockReset().mockReturnValue('mobileApp.jobs.actionFailed');
    timer.refresh.mockReset();
    offer.mockReset();
    snackbar.success.mockReset();
    snackbar.error.mockReset();
    snackbar.info.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: MobileApiService, useValue: api },
        { provide: MobileMoveConfirmService, useValue: confirmMove },
        { provide: MobileTimerService, useValue: timer },
        { provide: UndoService, useValue: { offer } },
        { provide: OfflineQueueService, useValue: { remove: vi.fn() } },
        { provide: SnackbarService, useValue: snackbar },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
  });

  it('moves an ordinary column with one quiet request and offers Undo', async () => {
    await create().onAction('move');

    expect(api.advanceJob).toHaveBeenCalledOnce();
    expect(api.advanceJob).toHaveBeenCalledWith(42, null, null, true);
    expect(confirmMove.ask).not.toHaveBeenCalled();
    expect(offer).toHaveBeenCalledOnce();
  });

  it('asks when the server needs a move confirmed, resends it for that status only, and offers no Undo', async () => {
    refuseUnconfirmed();

    await create().onAction('move');

    expect(confirmMove.ask).toHaveBeenCalledWith({ id: 42, nextStageId: 6, nextStageName: 'Invoiced' });
    expect(api.advanceJob).toHaveBeenLastCalledWith(42, null, 6, true);
    expect(offer).not.toHaveBeenCalled();
    expect(snackbar.success).toHaveBeenCalledWith('mobileApp.jobs.movedTo');
  });

  it('moves nothing and keeps the timer when the person declines a complete', async () => {
    refuseUnconfirmed();
    confirmMove.ask.mockResolvedValue(false);
    const lookup = create();

    await lookup.onAction('complete');

    expect(api.advanceJob).toHaveBeenCalledOnce();
    expect(api.stopTimer).not.toHaveBeenCalled();
    expect(offer).not.toHaveBeenCalled();
    expect(lookup.selected()).toEqual(job);
  });

  it('confirms a complete once, then stops the timer', async () => {
    refuseUnconfirmed();

    await create().onAction('complete');

    expect(confirmMove.ask).toHaveBeenCalledOnce();
    expect(api.advanceJob).toHaveBeenLastCalledWith(42, null, 6, true);
    expect(api.stopTimer).toHaveBeenCalledOnce();
  });

  it('offers no Undo when a confirmed move is saved offline', async () => {
    api.advanceJob.mockImplementation((_id: number, _code: null, confirmedStageId: number | null) => confirmedStageId !== null
      ? of({ queued: true, entryId: 'q-1' })
      : throwError(() => refusal));

    await create().onAction('move');

    expect(offer).not.toHaveBeenCalled();
    expect(snackbar.info).toHaveBeenCalledWith('mobileApp.offline.queued');
  });

  it('shows the server\'s reason once when a move is refused, and still stops the timer on a complete', async () => {
    const error = new HttpErrorResponse({ status: 409, error: { code: 'business-rule', detail: 'Quality checks are not complete.' } });
    api.advanceJob.mockReturnValue(throwError(() => error));
    confirmMove.failureMessage.mockReturnValue('Quality checks are not complete.');

    await create().onAction('complete');

    expect(confirmMove.failureMessage).toHaveBeenCalledWith(error);
    expect(snackbar.error).toHaveBeenCalledOnce();
    expect(snackbar.error).toHaveBeenCalledWith('Quality checks are not complete.');
    expect(api.stopTimer).toHaveBeenCalledOnce();
  });
});
