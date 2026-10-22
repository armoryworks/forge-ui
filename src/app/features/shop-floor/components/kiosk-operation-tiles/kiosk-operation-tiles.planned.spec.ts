import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { KioskOperationTilesComponent } from './kiosk-operation-tiles.component';
import { JobOperationRow } from '../../models/job-operation-row.model';

class PlannedLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({
      shopFloor: {
        operations: {
          quantityOf: '{{count}} / {{total}}',
          quantityOfPlanned: '{{count}} / {{total}} planned',
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

describe('KioskOperationTilesComponent planned quantity', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [KioskOperationTilesComponent],
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: PlannedLoader }, fallbackLang: 'en', lang: 'en' })],
    });
  });

  it('shows each step against its planned quantity, and against the job quantity when there is no plan', () => {
    const fixture = TestBed.createComponent(KioskOperationTilesComponent);
    fixture.componentRef.setInput('operations', [row(1, { plannedQuantity: 322 }), row(2, { plannedQuantity: null })]);
    fixture.componentRef.setInput('jobQuantity', 322);
    fixture.componentRef.setInput('now', 0);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="kiosk-op-tile-planned-1"]')?.textContent?.trim()).toBe('0 / 322 planned');
    expect(el.querySelector('[data-testid="kiosk-op-tile-planned-2"]')).toBeNull();
    expect(el.querySelector('[data-testid="kiosk-op-tile-2"] .op-tile__qty')?.textContent?.trim()).toBe('0 / 322');
  });

  it('counts the first step against the whole start when yield sets the start', () => {
    const fixture = TestBed.createComponent(KioskOperationTilesComponent);
    fixture.componentRef.setInput('operations', [row(1, { plannedQuantity: 112 }), row(2, { plannedQuantity: 105 })]);
    fixture.componentRef.setInput('jobQuantity', 112);
    fixture.componentRef.setInput('now', 0);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="kiosk-op-tile-planned-1"]')?.textContent?.trim()).toBe('0 / 112 planned');
    expect(el.querySelector('[data-testid="kiosk-op-tile-planned-2"]')?.textContent?.trim()).toBe('0 / 105 planned');
  });
});
