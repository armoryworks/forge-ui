import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
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
  const confirmMove = { needed: vi.fn(), ask: vi.fn(), isConfirmRequired: vi.fn(), failureMessage: vi.fn() };
  const offer = vi.fn();
  const snackbar = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

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
    offer.mockReset();
    snackbar.success.mockReset();
    snackbar.error.mockReset();
    snackbar.info.mockReset();
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
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
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
