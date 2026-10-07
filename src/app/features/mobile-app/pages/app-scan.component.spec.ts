import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { ScanResolveResult } from '../../../shared/models/mobile-api.model';
import { CameraScannerService } from '../../../shared/services/camera-scanner.service';
import { InstanceService } from '../../../shared/services/instance.service';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
import { MobileTimerService } from '../../../shared/services/mobile-timer.service';
import { OfflineQueueService } from '../../../shared/services/offline-queue.service';
import { ScanFeedbackService } from '../../../shared/services/scan-feedback.service';
import { SharedIdentityService } from '../../../shared/services/shared-identity.service';
import { UndoService } from '../../../shared/services/undo.service';
import { ScanAction } from '../components/scan-action-sheet/scan-action-sheet.component';
import { AppScanComponent } from './app-scan.component';

interface ScanInternals {
  result: WritableSignal<ScanResolveResult | null>;
  onAction(action: ScanAction): Promise<void>;
}

const job: ScanResolveResult = { kind: 'job', id: 42, code: 'JOB-42', label: 'JOB-42', subtitle: null };

describe('AppScanComponent', () => {
  let shared: boolean;
  const offer = vi.fn();
  const identity = {
    identified: signal(true),
    person: signal<{ firstName: string; lastName: string } | null>({ firstName: 'Ana', lastName: 'Ruiz' }),
    clear: vi.fn(),
    touch: vi.fn(),
  };
  const timer = {
    active: signal(null),
    start: vi.fn(),
    stop: vi.fn(),
    undoStart: vi.fn(),
    refresh: vi.fn(),
  };
  const api = {
    advanceJob: vi.fn(),
    moveJobToStage: vi.fn(),
    stopTimer: vi.fn(),
  };

  function create(): ScanInternals {
    const component = TestBed.runInInjectionContext(() => new AppScanComponent());
    const internals = component as unknown as ScanInternals;
    internals.result.set(job);
    return internals;
  }

  beforeEach(() => {
    shared = true;
    offer.mockReset();
    identity.identified.set(true);
    identity.clear.mockReset();
    identity.touch.mockReset();
    timer.start.mockReset().mockResolvedValue({ entryId: 11, queuedIds: [] });
    timer.stop.mockReset().mockResolvedValue({ jobNumber: 'JOB-42' });
    timer.undoStart.mockReset().mockResolvedValue(undefined);
    api.advanceJob.mockReset().mockReturnValue(of({
      status: { stageName: 'Machining' }, previousStageId: 3, previousStageName: 'Queued', collapsed: false,
    }));
    api.moveJobToStage.mockReset().mockReturnValue(of({}));
    TestBed.configureTestingModule({
      providers: [
        { provide: CameraScannerService, useValue: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() } },
        { provide: MobileApiService, useValue: api },
        { provide: ScanFeedbackService, useValue: { tick: vi.fn(), doubleBuzz: vi.fn() } },
        { provide: UndoService, useValue: { offer } },
        { provide: OfflineQueueService, useValue: { remove: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SharedIdentityService, useValue: identity },
        { provide: MobileTimerService, useValue: timer },
        { provide: InstanceService, useValue: { instance: () => ({ id: 'shop', shared }) } },
      ],
    });
  });

  it('undoes a start by deleting the new entry', async () => {
    await create().onAction('start');

    expect(timer.start).toHaveBeenCalledWith(42, 'JOB-42');
    const [, compensate] = offer.mock.calls[0];
    await compensate();
    expect(timer.undoStart).toHaveBeenCalledWith(11);
  });

  it('stops the timer without changing the stage', async () => {
    await create().onAction('stop');

    expect(timer.stop).toHaveBeenCalledOnce();
    expect(api.advanceJob).not.toHaveBeenCalled();
  });
});
