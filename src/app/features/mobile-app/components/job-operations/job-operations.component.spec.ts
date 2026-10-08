import { Component, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';

import { Observable, of, throwError } from 'rxjs';
import { TranslateLoader, TranslateService, provideTranslateService } from '@ngx-translate/core';

import { JobOperationRow } from '../../../../shared/models/job-operation-row.model';
import { JobOperations } from '../../../../shared/models/job-operations.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { InstanceService } from '../../../../shared/services/instance.service';
import { MobileApiService } from '../../../../shared/services/mobile-api.service';
import { MobileTimerService } from '../../../../shared/services/mobile-timer.service';
import { OfflineQueueService } from '../../../../shared/services/offline-queue.service';
import { SharedIdentityService } from '../../../../shared/services/shared-identity.service';
import { UndoService } from '../../../../shared/services/undo.service';
import { IdentityPromptComponent } from '../../identity/identity-prompt.component';
import { JobOperationsComponent } from './job-operations.component';

@Component({ selector: 'app-identity-prompt', standalone: true, template: '' })
class StubIdentityPromptComponent {
  readonly identified = output<void>();
  readonly cancelled = output<void>();
}

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function row(stepNumber: number, overrides: Partial<JobOperationRow> = {}): JobOperationRow {
  return {
    operationId: stepNumber, jobOperationId: null, version: null, stepNumber, title: `Step ${stepNumber}`,
    workCenterName: null, isRoutingStep: true, status: 'NotStarted', completedQuantity: 0, scrapQuantity: 0,
    startedAt: null, completedAt: null, completedByName: null, estimatedSetupMinutes: 0, estimatedRunMinutesEach: 1,
    estimatedRunMinutesLot: 0, estimatedTotalMinutes: 40, actualSetupMinutes: 0, actualRunMinutes: 0,
    actualOtherMinutes: 0, actualTotalMinutes: 0, actualRunMinutesEach: null, remainingMinutes: 40,
    historyRunMinutesEach: null, historyJobCount: 0, openTimers: [], ...overrides,
  };
}

function operations(rows: JobOperationRow[], overrides: Partial<JobOperations> = {}): JobOperations {
  return {
    jobId: 42, jobQuantity: 40, trackingEnabled: true, allOperationsComplete: false,
    estimatedRemainingMinutes: 120, serverNow: new Date().toISOString(), operations: rows, ...overrides,
  };
}

const mine = { timeEntryId: 31, userId: 1, userName: 'Ruiz, Ana', userInitials: 'AR', entryType: 'Run', timerStart: new Date().toISOString() };
const theirs = { timeEntryId: 32, userId: 2, userName: 'Lee, Sam', userInitials: 'SL', entryType: 'Run', timerStart: new Date().toISOString() };

describe('JobOperationsComponent', () => {
  let fixture: ComponentFixture<JobOperationsComponent>;
  let shared: boolean;
  const offer = vi.fn();
  const identified = signal(true);
  const identity = { identified, clear: vi.fn(), touch: vi.fn() };
  const timer = { refresh: vi.fn(), elapsedOf: vi.fn(() => '0:01:00') };
  const api = {
    jobOperations: vi.fn(),
    startOperationTimer: vi.fn(),
    stopOperationTimer: vi.fn(),
    updateOperationProgress: vi.fn(),
  };

  function render(data: JobOperations, compact = false): HTMLElement {
    api.jobOperations.mockReturnValue(of(data));
    fixture = TestBed.createComponent(JobOperationsComponent);
    fixture.componentRef.setInput('jobId', 42);
    fixture.componentRef.setInput('compact', compact);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const click = (testId: string): void => {
    el().querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!.click();
    fixture.detectChanges();
  };
  const settle = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  };

  beforeEach(() => {
    shared = false;
    identified.set(true);
    offer.mockReset();
    identity.clear.mockReset();
    identity.touch.mockReset();
    timer.refresh.mockReset().mockResolvedValue(undefined);
    api.jobOperations.mockReset();
    api.startOperationTimer.mockReset();
    api.stopOperationTimer.mockReset().mockReturnValue(of({ stopped: true, entry: null }));
    api.updateOperationProgress.mockReset();
    TestBed.configureTestingModule({
      imports: [JobOperationsComponent],
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: MobileApiService, useValue: api },
        { provide: MobileTimerService, useValue: timer },
        { provide: UndoService, useValue: { offer } },
        { provide: OfflineQueueService, useValue: { remove: vi.fn() } },
        { provide: SharedIdentityService, useValue: identity },
        { provide: InstanceService, useValue: { instance: () => ({ id: 'shop', shared }) } },
        { provide: AuthService, useValue: { user: signal({ id: 1 }), token: () => 'person-token' } },
      ],
    }).overrideComponent(JobOperationsComponent, {
      remove: { imports: [IdentityPromptComponent] },
      add: { imports: [StubIdentityPromptComponent] },
    });
    vi.spyOn(TestBed.inject(TranslateService), 'instant').mockImplementation((key: string | string[]) => key as string);
  });

  it('lists every step with its count, and Stop only where the person runs a timer', () => {
    render(operations([
      row(10, { status: 'Complete', completedQuantity: 40 }),
      row(20, { status: 'InProgress', completedQuantity: 12, openTimers: [mine, theirs] }),
      row(30),
    ]));

    expect(el().querySelectorAll('[data-testid^="job-operation-"][class*="ops__row"]').length).toBe(3);
    expect(el().querySelector('[data-testid="job-operation-count-20"]')!.textContent).toContain('12 / 40');
    expect(el().querySelector('[data-testid="job-operation-stop-20"]')).not.toBeNull();
    expect(el().querySelector('[data-testid="job-operation-start-30"]')).not.toBeNull();
    expect(el().querySelector('[data-testid="job-operation-start-10"]')).toBeNull();
    expect(el().querySelector('[data-testid="job-operation-20"]')!.textContent).toContain('SL');
  });

  it('in compact mode leaves out finished steps and puts the current one first', () => {
    render(operations([
      row(10, { status: 'Complete' }),
      row(20),
      row(30, { status: 'InProgress' }),
    ]), true);

    const steps = [...el().querySelectorAll('.ops__row')].map((r) => r.getAttribute('data-testid'));
    expect(steps).toEqual(['job-operation-30', 'job-operation-20']);
    expect(el().querySelector('[data-testid="job-operation-setup-20"]')).toBeNull();
  });

  it('offers no actions while tracking is off or on a step that left the routing', () => {
    render(operations([row(10), row(20, { isRoutingStep: false, operationId: null })], { trackingEnabled: false }));

    expect(el().querySelector('[data-testid="job-operation-start-10"]')).toBeNull();
    expect(el().querySelector('[data-testid="job-operation-start-20"]')).toBeNull();
  });

  it('starts a step and undoes it by stopping that step', async () => {
    render(operations([row(20)]));
    api.startOperationTimer.mockReturnValue(of({ entry: {}, alreadyRunning: false, operation: row(20) }));

    click('job-operation-start-20');
    await settle();

    expect(api.startOperationTimer).toHaveBeenCalledWith(42, 20, 'Run');
    expect(timer.refresh).toHaveBeenCalled();
    const [message, compensate, closed] = offer.mock.calls[0];
    expect(message).toBe('mobileApp.operations.started');
    expect(closed).toBeUndefined();
    await compensate();
    expect(api.stopOperationTimer).toHaveBeenCalledWith(42, 20, undefined);
  });

  it('starts setup from the full list', async () => {
    render(operations([row(20)]));
    api.startOperationTimer.mockReturnValue(of({ entry: {}, alreadyRunning: false, operation: row(20) }));

    click('job-operation-setup-20');
    await settle();

    expect(api.startOperationTimer).toHaveBeenCalledWith(42, 20, 'Setup');
  });

  it('says so instead of offering undo when the step was already running', async () => {
    render(operations([row(20)]));
    api.startOperationTimer.mockReturnValue(of({ entry: {}, alreadyRunning: true, operation: row(20) }));

    click('job-operation-start-20');
    await settle();

    expect(offer).not.toHaveBeenCalled();
    expect(el().querySelector('[data-testid="job-operations-notice"]')!.textContent).toContain('mobileApp.operations.alreadyRunning');
  });

  it('stops the person\'s timer on a step and undoes by starting the same kind again', async () => {
    render(operations([row(20, { status: 'InProgress', openTimers: [mine] })]));
    api.stopOperationTimer.mockReturnValue(of({ stopped: true, entry: { entryType: 'Setup' } }));
    api.startOperationTimer.mockReturnValue(of({ entry: {}, alreadyRunning: false, operation: row(20) }));

    click('job-operation-stop-20');
    await settle();

    expect(api.stopOperationTimer).toHaveBeenCalledWith(42, 20);
    await offer.mock.calls[0][1]();
    expect(api.startOperationTimer).toHaveBeenCalledWith(42, 20, 'Setup', undefined);
  });

  it('records Done with the counts and version, then undoes with the earlier values', async () => {
    const before = row(20, { status: 'InProgress', completedQuantity: 12, version: 3, jobOperationId: 8 });
    render(operations([before]));
    api.updateOperationProgress.mockReturnValue(of({
      operation: { ...before, status: 'Complete', completedQuantity: 40, version: 4 },
      allOperationsComplete: false,
      estimatedRemainingMinutes: 0,
    }));

    click('job-operation-done-20');
    expect(el().querySelector('[data-testid="operation-qty-good"]')!.textContent).toContain('40');
    click('operation-qty-done');
    await settle();

    expect(api.updateOperationProgress).toHaveBeenCalledWith(42, 20, {
      completedQuantity: 40, scrapQuantity: 0, status: 'Complete', expectedVersion: 3,
    });
    expect(el().querySelector('[data-testid="operation-quantity-sheet"]')).toBeNull();
    await offer.mock.calls[0][1]();
    expect(api.updateOperationProgress).toHaveBeenLastCalledWith(42, 20, {
      completedQuantity: 12, scrapQuantity: 0, status: 'InProgress', expectedVersion: 4,
    }, undefined);
  });

  it('records a count without finishing, leaving the status alone on undo', async () => {
    const before = row(20, { status: 'InProgress', completedQuantity: 12, version: 3 });
    render(operations([before]));
    api.updateOperationProgress.mockReturnValue(of({
      operation: { ...before, completedQuantity: 13, version: 4 }, allOperationsComplete: false, estimatedRemainingMinutes: 27,
    }));

    click('job-operation-qty-20');
    click('operation-qty-plus');
    click('operation-qty-record');
    await settle();

    expect(api.updateOperationProgress).toHaveBeenCalledWith(42, 20, { completedQuantity: 13, scrapQuantity: 0, expectedVersion: 3 });
    expect(offer.mock.calls[0][0]).toBe('mobileApp.operations.recorded');
    await offer.mock.calls[0][1]();
    expect(api.updateOperationProgress).toHaveBeenLastCalledWith(42, 20, { completedQuantity: 12, scrapQuantity: 0, expectedVersion: 4 }, undefined);
  });

  it('offers the gated move once the last step is done, and hands it to the page', async () => {
    render(operations([row(20, { status: 'InProgress' })]));
    api.updateOperationProgress.mockReturnValue(of({
      operation: row(20, { status: 'Complete', completedQuantity: 40, version: 1 }), allOperationsComplete: true, estimatedRemainingMinutes: 0,
    }));
    const moved = vi.fn();
    fixture.componentInstance.moveRequested.subscribe(moved);

    click('job-operation-done-20');
    click('operation-qty-done');
    await settle();
    click('job-operations-move');

    expect(moved).toHaveBeenCalledOnce();
    expect(el().querySelector('[data-testid="job-operations-move"]')).toBeNull();
  });

  it('shows a conflict and reloads when the server refuses with 409', async () => {
    render(operations([row(20, { status: 'InProgress', version: 3 })]));
    api.updateOperationProgress.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    api.jobOperations.mockClear();

    click('job-operation-done-20');
    click('operation-qty-done');
    await settle();

    expect(el().querySelector('[data-testid="job-operations-notice"]')!.textContent).toContain('mobileApp.operations.conflict');
    expect(api.jobOperations).toHaveBeenCalledWith(42);
    expect(offer).not.toHaveBeenCalled();
  });

  it('on a shared device, identifies first, undoes as that person, and ends the identity after', async () => {
    shared = true;
    identified.set(false);
    render(operations([row(20)]));
    api.startOperationTimer.mockReturnValue(of({ entry: {}, alreadyRunning: false, operation: row(20) }));

    click('job-operation-start-20');
    expect(api.startOperationTimer).not.toHaveBeenCalled();
    identified.set(true);
    (fixture.debugElement.query((d) => d.componentInstance instanceof StubIdentityPromptComponent)
      .componentInstance as StubIdentityPromptComponent).identified.emit();
    await settle();

    expect(api.startOperationTimer).toHaveBeenCalledWith(42, 20, 'Run');
    const [, compensate, closed] = offer.mock.calls[0];
    await compensate();
    expect(api.stopOperationTimer).toHaveBeenCalledWith(42, 20, 'person-token');
    closed();
    expect(identity.clear).toHaveBeenCalledOnce();
  });

  it('says operations need a connection when they cannot load', () => {
    api.jobOperations.mockReturnValue(throwError(() => new Error('offline')));
    fixture = TestBed.createComponent(JobOperationsComponent);
    fixture.componentRef.setInput('jobId', 42);
    fixture.detectChanges();

    expect(el().textContent).toContain('mobileApp.operations.loadFailed');
  });
});
