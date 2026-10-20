import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';

import { of, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { JobStatus } from '../../../shared/models/mobile-api.model';
import { InstanceService } from '../../../shared/services/instance.service';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
import { MobileMoveConfirmService } from '../../../shared/services/mobile-move-confirm.service';
import { MobileTimerService } from '../../../shared/services/mobile-timer.service';
import { OfflineQueueService } from '../../../shared/services/offline-queue.service';
import { PlatformService } from '../../../shared/services/platform.service';
import { SharedIdentityService } from '../../../shared/services/shared-identity.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { UndoService } from '../../../shared/services/undo.service';
import { AppJobStatusComponent } from './app-job-status.component';

interface JobStatusInternals {
  job: WritableSignal<JobStatus | null>;
  busy: WritableSignal<boolean>;
  advance(): void;
  back(): void;
}

const status: JobStatus = {
  id: 42, jobNumber: 'JOB-42', title: 'Bracket', customerName: null, stageId: 5, stageName: 'Shipped',
  stageColor: '#000', dueDate: null, isOverdue: false, nextStageId: 6, nextStageName: 'Invoiced',
  previousStageId: 4, previousStageName: 'QC', rowVersion: 1, recentActivity: [],
  nextStageIsIrreversible: true, nextStageAccountingDocument: 'Invoice',
};

describe('AppJobStatusComponent advancing', () => {
  const api = {
    jobStatus: vi.fn(),
    notePresets: vi.fn(() => of([])),
    advanceJob: vi.fn(),
    moveJobToStage: vi.fn(),
  };
  const confirmMove = {
    needed: vi.fn(), ask: vi.fn(), isConfirmRequired: vi.fn(), failureMessage: vi.fn(),
    mayBill: vi.fn(), officeOnly: vi.fn(), officeOnlyMessage: vi.fn(),
  };
  const offer = vi.fn();
  const snackbar = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  const location = { getState: vi.fn(), back: vi.fn() };
  const router = { navigate: vi.fn() };

  function create(): JobStatusInternals {
    const component = TestBed.runInInjectionContext(() => new AppJobStatusComponent());
    return component as unknown as JobStatusInternals;
  }

  beforeEach(() => {
    api.jobStatus.mockReset().mockReturnValue(of(status));
    api.advanceJob.mockReset().mockReturnValue(of({
      status: { ...status, stageName: 'Invoiced' }, previousStageId: 5, previousStageName: 'Shipped', collapsed: false,
    }));
    confirmMove.needed.mockReset().mockReturnValue(true);
    confirmMove.ask.mockReset().mockResolvedValue(true);
    confirmMove.isConfirmRequired.mockReset().mockReturnValue(false);
    confirmMove.failureMessage.mockReset().mockImplementation((err: unknown) => (confirmMove.isConfirmRequired(err)
      ? 'mobileAppWork.confirmMove.changed'
      : 'mobileApp.jobs.actionFailed'));
    confirmMove.mayBill.mockReset().mockReturnValue(true);
    confirmMove.officeOnly.mockReset().mockReturnValue(false);
    confirmMove.officeOnlyMessage.mockReset().mockReturnValue('mobileAppWork.confirmMove.officeOnly');
    offer.mockReset();
    snackbar.success.mockReset();
    snackbar.error.mockReset();
    snackbar.info.mockReset();
    location.getState.mockReset().mockReturnValue({ navigationId: 3 });
    location.back.mockReset();
    router.navigate.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: MobileApiService, useValue: api },
        { provide: MobileMoveConfirmService, useValue: confirmMove },
        { provide: MobileTimerService, useValue: { runningOn: () => false } },
        { provide: UndoService, useValue: { offer } },
        { provide: OfflineQueueService, useValue: { remove: vi.fn() } },
        { provide: SnackbarService, useValue: snackbar },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: PlatformService, useValue: { mobileShell: true, isNative: false } },
        { provide: SharedIdentityService, useValue: { identified: signal(false), touch: vi.fn() } },
        { provide: InstanceService, useValue: { instance: () => ({ id: 'shop', shared: false }) } },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '42' })) } },
        { provide: Router, useValue: router },
        { provide: Location, useValue: location },
      ],
    });
  });

  it('shows the failed state for a non-numeric id without calling the API', () => {
    TestBed.overrideProvider(ActivatedRoute, { useValue: { paramMap: of(convertToParamMap({ id: 'abc' })) } });
    const component = create() as unknown as { loading(): boolean; failed(): boolean };
    expect(component.loading()).toBe(false);
    expect(component.failed()).toBe(true);
    expect(api.jobStatus).not.toHaveBeenCalled();
  });

  it('goes back to the list or search it was opened from', () => {
    create().back();

    expect(location.back).toHaveBeenCalledOnce();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('goes to Scan when the page was opened directly', () => {
    location.getState.mockReturnValue({ navigationId: 1 });

    create().back();

    expect(location.back).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/app/scan']);
  });

  it('asks before moving into Invoiced, confirms that status only, and offers no Undo', async () => {
    const page = create();

    page.advance();
    await vi.waitFor(() => expect(snackbar.success).toHaveBeenCalledWith('mobileApp.jobs.movedTo'));

    expect(confirmMove.ask).toHaveBeenCalledWith(status);
    expect(api.advanceJob).toHaveBeenCalledWith(42, null, 6, true);
    expect(offer).not.toHaveBeenCalled();
    expect(page.job()?.stageName).toBe('Invoiced');
  });

  it('leaves a billing column to the office: nothing is sent and the reason is shown', async () => {
    confirmMove.officeOnly.mockReturnValue(true);
    const page = create();

    page.advance();
    await vi.waitFor(() => expect(snackbar.info).toHaveBeenCalledWith('mobileAppWork.confirmMove.officeOnly'));

    expect(confirmMove.ask).not.toHaveBeenCalled();
    expect(api.advanceJob).not.toHaveBeenCalled();
  });

  it('moves nothing when the person declines', async () => {
    confirmMove.ask.mockResolvedValue(false);
    const page = create();

    page.advance();
    await vi.waitFor(() => expect(page.busy()).toBe(false));

    expect(confirmMove.ask).toHaveBeenCalledOnce();
    expect(api.advanceJob).not.toHaveBeenCalled();
  });

  it('moves an ordinary column without asking and offers Undo', async () => {
    confirmMove.needed.mockReturnValue(false);
    const page = create();

    page.advance();
    await vi.waitFor(() => expect(offer).toHaveBeenCalledOnce());

    expect(confirmMove.ask).not.toHaveBeenCalled();
    expect(api.advanceJob).toHaveBeenCalledWith(42, null, null, true);
  });

  it('undoes the move with the job version the advance returned, not one read before it', async () => {
    confirmMove.needed.mockReturnValue(false);
    api.advanceJob.mockReturnValue(of({
      status: { ...status, stageName: 'Invoiced', rowVersion: 7 }, previousStageId: 5, previousStageName: 'Shipped', collapsed: false,
    }));
    api.moveJobToStage.mockReturnValue(of(status));
    const page = create();

    page.advance();
    await vi.waitFor(() => expect(offer).toHaveBeenCalledOnce());
    await offer.mock.calls[0][1]();

    expect(api.moveJobToStage).toHaveBeenCalledWith(42, 5, undefined, 7);
  });

  it('reloads and says so when the server wants a confirmation the page did not know about', async () => {
    confirmMove.needed.mockReturnValue(false);
    confirmMove.isConfirmRequired.mockReturnValue(true);
    api.advanceJob.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400 })));
    const page = create();

    page.advance();
    await vi.waitFor(() => expect(snackbar.error).toHaveBeenCalledWith('mobileAppWork.confirmMove.changed'));

    expect(api.jobStatus).toHaveBeenCalledTimes(2);
  });

  it('shows the server\'s reason once when an ordinary move is refused', async () => {
    confirmMove.needed.mockReturnValue(false);
    confirmMove.failureMessage.mockReturnValue('Quality checks are not complete.');
    api.advanceJob.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    const page = create();

    page.advance();
    await vi.waitFor(() => expect(page.busy()).toBe(false));

    expect(api.advanceJob).toHaveBeenCalledWith(42, null, null, true);
    expect(snackbar.error).toHaveBeenCalledOnce();
    expect(snackbar.error).toHaveBeenCalledWith('Quality checks are not complete.');
  });

  it('shows the server\'s reason once when a confirmed move is refused', async () => {
    confirmMove.failureMessage.mockReturnValue('Quality checks are not complete.');
    api.advanceJob.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    const page = create();

    page.advance();
    await vi.waitFor(() => expect(page.busy()).toBe(false));

    expect(confirmMove.ask).toHaveBeenCalledOnce();
    expect(api.advanceJob).toHaveBeenCalledWith(42, null, 6, true);
    expect(snackbar.error).toHaveBeenCalledOnce();
    expect(snackbar.error).toHaveBeenCalledWith('Quality checks are not complete.');
  });

  it('offers no Undo when a confirmed move is saved offline, and still names the confirmed status', async () => {
    api.advanceJob.mockReturnValue(of({ queued: true, entryId: 'q-1' }));
    const page = create();

    page.advance();
    await vi.waitFor(() => expect(snackbar.info).toHaveBeenCalledWith('mobileApp.offline.queued'));

    expect(api.advanceJob).toHaveBeenCalledWith(42, null, 6, true);
    expect(offer).not.toHaveBeenCalled();
  });
});
