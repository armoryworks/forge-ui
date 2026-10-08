import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { OperationTouchListComponent } from './operation-touch-list.component';
import { JobOperationRow } from '../../models/job-operation-row.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function op(overrides: Partial<JobOperationRow> = {}): JobOperationRow {
  return {
    operationId: 7, jobOperationId: 3, version: 1, stepNumber: 2, title: 'Mill', workCenterName: null,
    isRoutingStep: true, status: 'InProgress', completedQuantity: 20, scrapQuantity: 0,
    startedAt: null, completedAt: null, completedByName: null,
    estimatedSetupMinutes: 0, estimatedRunMinutesEach: 3, estimatedRunMinutesLot: 0, estimatedTotalMinutes: 120,
    actualSetupMinutes: 0, actualRunMinutes: 0, actualOtherMinutes: 0, actualTotalMinutes: 0,
    actualRunMinutesEach: null, remainingMinutes: 60, historyRunMinutesEach: null, historyJobCount: 0,
    openTimers: [], ...overrides,
  };
}

describe('OperationTouchListComponent', () => {
  let fixture: ComponentFixture<OperationTouchListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OperationTouchListComponent],
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } })],
    });
  });

  afterEach(() => fixture?.destroy());

  function render(operations: JobOperationRow[]): HTMLElement {
    fixture = TestBed.createComponent(OperationTouchListComponent);
    fixture.componentRef.setInput('operations', operations);
    fixture.componentRef.setInput('jobQuantity', 40);
    fixture.componentRef.setInput('currentUserId', 1);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('offers Stop for my running step and shows who else is on it', () => {
    const el = render([op({ openTimers: [
      { timeEntryId: 1, userId: 1, userName: 'Rivera, Sam', userInitials: 'SR', entryType: 'Run', timerStart: new Date().toISOString() },
      { timeEntryId: 2, userId: 2, userName: 'Lee, Ana', userInitials: 'AL', entryType: 'Run', timerStart: new Date().toISOString() },
    ] })]);
    const row = el.querySelector('[data-testid="operation-touch-row-2"]')!;
    expect(row.querySelector('[data-testid="operation-touch-stop"]')).not.toBeNull();
    expect(row.querySelector('[data-testid="operation-touch-start"]')).toBeNull();
    expect(row.textContent).toContain('AL');
  });

  it('emits start with the chosen entry type, done and quantity requests', () => {
    const el = render([op()]);
    const start = vi.fn();
    const done = vi.fn();
    const qty = vi.fn();
    fixture.componentInstance.startRequested.subscribe(start);
    fixture.componentInstance.doneRequested.subscribe(done);
    fixture.componentInstance.quantityRequested.subscribe(qty);

    el.querySelector<HTMLButtonElement>('[data-testid="operation-touch-start-setup"]')!.click();
    el.querySelector<HTMLButtonElement>('[data-testid="operation-touch-done"]')!.click();
    el.querySelector<HTMLButtonElement>('[data-testid="operation-touch-qty"]')!.click();

    expect(start.mock.calls[0][0].entryType).toBe('Setup');
    expect(done).toHaveBeenCalledOnce();
    expect(qty).toHaveBeenCalledOnce();
  });

  it('hides the actions of finished steps', () => {
    const el = render([op({ status: 'Complete' })]);
    expect(el.querySelector('[data-testid="operation-touch-done"]')).toBeNull();
    expect(el.querySelector('[data-testid="operation-touch-start"]')).toBeNull();
  });
});
