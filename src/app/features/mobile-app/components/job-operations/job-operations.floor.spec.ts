import { Component, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Observable, of } from 'rxjs';
import { TranslateLoader, TranslateService, provideTranslateService } from '@ngx-translate/core';

import { JobOperationRow } from '../../../../shared/models/job-operation-row.model';
import { JobOperations } from '../../../../shared/models/job-operations.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { InstanceService } from '../../../../shared/services/instance.service';
import { MobileApiService } from '../../../../shared/services/mobile-api.service';
import { MobileTimerService } from '../../../../shared/services/mobile-timer.service';
import { OfflineQueueService } from '../../../../shared/services/offline-queue.service';
import { SharedIdentityService } from '../../../../shared/services/shared-identity.service';
import { UndoService } from '../../../../shared/services/undo.service';
import { SpcRecordPanelComponent } from '../../../quality/components/spc-record-panel/spc-record-panel.component';
import { SpcCharacteristic } from '../../../quality/models/spc.model';
import { SpcService } from '../../../quality/services/spc.service';
import { JobOperationsComponent } from './job-operations.component';

@Component({ selector: 'app-spc-record-panel', standalone: true, template: '<div data-testid="spc-record-panel"></div>' })
class StubSpcRecordPanelComponent {
  readonly characteristics = input<SpcCharacteristic[]>([]);
  readonly jobId = input<number>(0);
  readonly closed = output<void>();
}

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function row(stepNumber: number, overrides: Partial<JobOperationRow> = {}): JobOperationRow {
  return {
    operationId: stepNumber, jobOperationId: null, version: null, stepNumber, title: `Step ${stepNumber}`,
    workCenterName: null, isRoutingStep: true, status: 'InProgress', completedQuantity: 0, scrapQuantity: 0,
    startedAt: null, completedAt: null, completedByName: null, estimatedSetupMinutes: 0, estimatedRunMinutesEach: 1,
    estimatedRunMinutesLot: 0, estimatedTotalMinutes: 40, actualSetupMinutes: 0, actualRunMinutes: 0,
    actualOtherMinutes: 0, actualTotalMinutes: 0, actualRunMinutesEach: null, remainingMinutes: 40,
    historyRunMinutesEach: null, historyJobCount: 0, openTimers: [], ...overrides,
  };
}

function operations(rows: JobOperationRow[]): JobOperations {
  return {
    jobId: 42, jobQuantity: 40, trackingEnabled: true, allOperationsComplete: false,
    estimatedRemainingMinutes: 120, serverNow: new Date().toISOString(), operations: rows,
  };
}

const myRun = { timeEntryId: 31, userId: 1, userName: 'Ruiz, Ana', userInitials: 'AR', entryType: 'Run', timerStart: new Date().toISOString() };

describe('JobOperationsComponent · SPC and rework time', () => {
  let fixture: ComponentFixture<JobOperationsComponent>;
  let spcOn: boolean;
  const api = {
    jobOperations: vi.fn(),
    operationsConfig: vi.fn(() => of({ operationTracking: true, reasons: [] })),
    startOperationTimer: vi.fn(() => of({ entry: {}, alreadyRunning: false, operation: row(30) })),
    stopOperationTimer: vi.fn(() => of({ stopped: true, entry: null })),
    updateOperationProgress: vi.fn(),
  };
  const spc = { getJobCharacteristics: vi.fn(() => of([{ id: 7, operationId: 30, isActive: true } as SpcCharacteristic])) };

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const click = (testId: string): void => {
    el().querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!.click();
    fixture.detectChanges();
  };
  const settle = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  };

  function render(data: JobOperations): void {
    api.jobOperations.mockReturnValue(of(data));
    fixture = TestBed.createComponent(JobOperationsComponent);
    fixture.componentRef.setInput('jobId', 42);
    fixture.detectChanges();
  }

  beforeEach(() => {
    spcOn = true;
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [JobOperationsComponent],
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: MobileApiService, useValue: api },
        { provide: MobileTimerService, useValue: { refresh: vi.fn().mockResolvedValue(undefined), elapsedOf: vi.fn(() => '0:01:00') } },
        { provide: UndoService, useValue: { offer: vi.fn() } },
        { provide: OfflineQueueService, useValue: { remove: vi.fn() } },
        { provide: SharedIdentityService, useValue: { identified: signal(true), clear: vi.fn(), touch: vi.fn() } },
        { provide: InstanceService, useValue: { instance: () => ({ id: 'shop', shared: false }) } },
        { provide: AuthService, useValue: { user: signal({ id: 1 }), token: () => 'person-token' } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => code !== 'CAP-QC-SPC' || spcOn } },
        { provide: SpcService, useValue: spc },
      ],
    }).overrideComponent(JobOperationsComponent, {
      remove: { imports: [SpcRecordPanelComponent] },
      add: { imports: [StubSpcRecordPanelComponent] },
    });
    vi.spyOn(TestBed.inject(TranslateService), 'instant').mockImplementation((key: string | string[]) => key as string);
  });

  it('shows SPC only on the step with a characteristic and opens the entry panel', async () => {
    render(operations([row(20), row(30)]));

    expect(spc.getJobCharacteristics).toHaveBeenCalledWith(42);
    expect(el().querySelector('[data-testid="job-operation-spc-20"]')).toBeNull();
    click('job-operation-spc-30');
    await settle();

    expect(el().querySelector('[data-testid="spc-record-panel"]')).not.toBeNull();
  });

  it('hides SPC when the capability is off', () => {
    spcOn = false;
    render(operations([row(30)]));

    expect(spc.getJobCharacteristics).not.toHaveBeenCalled();
    expect(el().querySelector('[data-testid="job-operation-spc-30"]')).toBeNull();
  });

  it('books rework time from the quantity sheet: stops the Run timer and starts a Rework timer', async () => {
    const before = row(30, { openTimers: [myRun], completedQuantity: 5 });
    render(operations([before]));
    api.updateOperationProgress.mockReturnValue(of({ operation: before, allOperationsComplete: false, estimatedRemainingMinutes: 20 }));

    click('job-operation-qty-30');
    click('operation-rework-open');
    click('operation-rework-plus');
    expect(el().querySelector('[data-testid="operation-rework-time"]')).not.toBeNull();
    click('operation-qty-record');
    await settle();

    expect(api.updateOperationProgress).toHaveBeenCalledWith(42, 30, expect.objectContaining({ reworkQuantity: 1 }));
    expect(api.stopOperationTimer).toHaveBeenCalledWith(42, 30);
    expect(api.startOperationTimer).toHaveBeenCalledWith(42, 30, 'Rework');
  });

  it('leaves the timers when the operator is already on rework', async () => {
    const before = row(30, { openTimers: [myRun], completedQuantity: 5 });
    render(operations([before]));
    api.updateOperationProgress.mockReturnValue(of({ operation: before, allOperationsComplete: false, estimatedRemainingMinutes: 20 }));

    click('job-operation-qty-30');
    click('operation-rework-open');
    click('operation-rework-plus');
    click('operation-rework-already');
    click('operation-qty-record');
    await settle();

    expect(api.updateOperationProgress).toHaveBeenCalled();
    expect(api.stopOperationTimer).not.toHaveBeenCalled();
    expect(api.startOperationTimer).not.toHaveBeenCalled();
  });
});
