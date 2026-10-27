import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateService, TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { KioskOperationTilesComponent } from './kiosk-operation-tiles.component';
import { JobOperationRow } from '../../models/job-operation-row.model';
import { StepGatingMode } from '../../../../shared/models/step-gating-mode.type';

class GateLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({
      shopFloor: {
        operations: {
          available: 'Available: {{available}} from Op {{step}}',
          waitingOn: 'Waits for Op {{steps}}',
        },
      },
    });
  }
}

function row(stepNumber: number, overrides: Partial<JobOperationRow> = {}): JobOperationRow {
  return {
    operationId: 100 + stepNumber, jobOperationId: null, version: null, stepNumber, title: `Step ${stepNumber}`,
    workCenterName: null, isRoutingStep: true, status: 'NotStarted', completedQuantity: 0, scrapQuantity: 0,
    startedAt: null, completedAt: null, completedByName: null,
    estimatedSetupMinutes: 0, estimatedRunMinutesEach: 1, estimatedRunMinutesLot: 0, estimatedTotalMinutes: 40,
    actualSetupMinutes: 0, actualRunMinutes: 0, actualOtherMinutes: 0, actualTotalMinutes: 0,
    actualRunMinutesEach: null, remainingMinutes: 40, historyRunMinutesEach: null, historyJobCount: 0, openTimers: [],
    ...overrides,
  };
}

function render(gating: StepGatingMode): HTMLElement {
  const fixture = TestBed.createComponent(KioskOperationTilesComponent);
  fixture.componentRef.setInput('operations', [
    row(10),
    row(20, { available: 12, availableFromStep: 10 }),
    row(30, { available: 0, availableFromStep: 20, waitingOnSteps: [20] }),
  ]);
  fixture.componentRef.setInput('jobQuantity', 20);
  fixture.componentRef.setInput('now', 0);
  fixture.componentRef.setInput('gating', gating);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('KioskOperationTilesComponent step gate hints', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [KioskOperationTilesComponent],
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: GateLoader }, fallbackLang: 'en', lang: 'en' }),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
  });

  it('shows what each step may report in Warn mode, without a lock', () => {
    const el = render('Warn');

    expect(el.querySelector('[data-testid="kiosk-op-gate-10"]')).toBeNull();
    expect(el.querySelector('[data-testid="kiosk-op-gate-20"]')?.textContent?.trim()).toBe('Available: 12 from Op 10');
    expect(el.querySelector('[data-testid="kiosk-op-gate-30"]')?.textContent).toContain('Waits for Op 20');
    expect(el.querySelector('.op-tile__gate-icon')).toBeNull();
  });

  it('adds a lock in Block mode', () => {
    const el = render('Block');

    expect(el.querySelector('[data-testid="kiosk-op-gate-20"] .op-tile__gate-icon')?.textContent?.trim()).toBe('lock');
  });

  it('offers a rework timer beside run and setup, and emits the step for it', () => {
    const fixture = TestBed.createComponent(KioskOperationTilesComponent);
    fixture.componentRef.setInput('operations', [row(10)]);
    fixture.componentRef.setInput('jobQuantity', 20);
    fixture.componentRef.setInput('now', 0);
    const reworks: JobOperationRow[] = [];
    fixture.componentInstance.startRework.subscribe(r => reworks.push(r));
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="kiosk-op-start-rework-10"]')!.click();

    expect(reworks.map(r => r.stepNumber)).toEqual([10]);
  });

  it('changes nothing when gating is off', () => {
    const el = render('Off');

    expect(el.querySelector('.op-tile__gate')).toBeNull();
  });
});
