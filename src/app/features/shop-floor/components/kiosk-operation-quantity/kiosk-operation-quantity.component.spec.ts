import { TestBed } from '@angular/core/testing';

import { KioskOperationQuantityComponent } from './kiosk-operation-quantity.component';
import { JobOperationRow } from '../../models/job-operation-row.model';
import { UpdateJobOperationProgressRequest } from '../../models/update-job-operation-progress-request.model';

interface QuantityInternals {
  completed: () => number | null;
  scrap: () => number;
  overLimit: () => boolean;
  canSubmit: () => boolean;
  activeField: { set: (f: 'completed' | 'scrap') => void };
  ngOnInit(): void;
  onDigit(d: string): void;
  onBackspace(): void;
  onClear(): void;
  finish(): void;
  record(): void;
}

function row(overrides: Partial<JobOperationRow> = {}): JobOperationRow {
  return {
    operationId: 102, jobOperationId: 7, version: 4, stepNumber: 2, title: 'Deburr',
    workCenterName: null, isRoutingStep: true, status: 'InProgress', completedQuantity: 12, scrapQuantity: 1,
    startedAt: null, completedAt: null, completedByName: null,
    estimatedSetupMinutes: 0, estimatedRunMinutesEach: 1, estimatedRunMinutesLot: 0, estimatedTotalMinutes: 40,
    actualSetupMinutes: 0, actualRunMinutes: 0, actualOtherMinutes: 0, actualTotalMinutes: 0,
    actualRunMinutesEach: null, remainingMinutes: 27, historyRunMinutesEach: null, historyJobCount: 0, openTimers: [],
    ...overrides,
  };
}

describe('KioskOperationQuantityComponent', () => {
  function create(prefillAll: boolean, operation = row()): { c: QuantityInternals; emitted: UpdateJobOperationProgressRequest[] } {
    const fixture = TestBed.createComponent(KioskOperationQuantityComponent);
    fixture.componentRef.setInput('operation', operation);
    fixture.componentRef.setInput('jobQuantity', 40);
    fixture.componentRef.setInput('prefillAll', prefillAll);
    const emitted: UpdateJobOperationProgressRequest[] = [];
    fixture.componentInstance.submitted.subscribe(r => emitted.push(r));
    const c = fixture.componentInstance as unknown as QuantityInternals;
    c.ngOnInit();
    return { c, emitted };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [KioskOperationQuantityComponent] });
    TestBed.overrideComponent(KioskOperationQuantityComponent, { set: { template: '', imports: [] } });
  });

  it('Done is prefilled with everything not scrapped and completes the step', () => {
    const { c, emitted } = create(true);
    expect(c.completed()).toBe(39);
    expect(c.scrap()).toBe(1);
    c.finish();
    expect(emitted).toEqual([{ completedQuantity: 39, scrapQuantity: 1, expectedVersion: 4, status: 'Complete' }]);
  });

  it('+Qty starts from the current count and records an absolute value without completing', () => {
    const { c, emitted } = create(false);
    expect(c.completed()).toBe(12);
    c.onClear();
    c.onDigit('2');
    c.onDigit('0');
    c.record();
    expect(emitted).toEqual([{ completedQuantity: 20, scrapQuantity: 1, expectedVersion: 4 }]);
  });

  it('the keypad edits the scrap count when that field is active', () => {
    const { c } = create(false, row({ scrapQuantity: 0 }));
    c.activeField.set('scrap');
    c.onDigit('3');
    expect(c.scrap()).toBe(3);
    c.onBackspace();
    expect(c.scrap()).toBe(0);
    expect(c.completed()).toBe(12);
  });

  it('warns and refuses when completed plus scrap exceeds the job quantity', () => {
    const { c, emitted } = create(false);
    c.onClear();
    c.onDigit('4');
    c.onDigit('0');
    expect(c.overLimit()).toBe(true);
    expect(c.canSubmit()).toBe(false);
    c.finish();
    c.record();
    expect(emitted).toEqual([]);
  });

  it('refuses an empty count', () => {
    const { c } = create(false);
    c.onClear();
    expect(c.completed()).toBeNull();
    expect(c.canSubmit()).toBe(false);
  });
});
