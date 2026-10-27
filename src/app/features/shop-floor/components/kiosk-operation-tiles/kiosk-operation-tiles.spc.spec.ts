import { TestBed } from '@angular/core/testing';

import { KioskOperationTilesComponent } from './kiosk-operation-tiles.component';
import { JobOperationRow } from '../../models/job-operation-row.model';
import { SpcCharacteristic } from '../../../quality/models/spc.model';

function row(stepNumber: number): JobOperationRow {
  return {
    operationId: 100 + stepNumber, jobOperationId: null, version: null, stepNumber, title: `Step ${stepNumber}`,
    workCenterName: null, isRoutingStep: true, status: 'NotStarted', completedQuantity: 0, scrapQuantity: 0,
    startedAt: null, completedAt: null, completedByName: null,
    estimatedSetupMinutes: 0, estimatedRunMinutesEach: 1, estimatedRunMinutesLot: 0, estimatedTotalMinutes: 40,
    actualSetupMinutes: 0, actualRunMinutes: 0, actualOtherMinutes: 0, actualTotalMinutes: 0,
    actualRunMinutesEach: null, remainingMinutes: 40, historyRunMinutesEach: null, historyJobCount: 0, openTimers: [],
  };
}

function characteristic(operationId: number | null, isActive = true): SpcCharacteristic {
  return { id: operationId ?? 0, operationId, isActive } as SpcCharacteristic;
}

describe('KioskOperationTilesComponent · Record SPC', () => {
  function hasSpc(characteristics: SpcCharacteristic[]): boolean[] {
    const fixture = TestBed.createComponent(KioskOperationTilesComponent);
    fixture.componentRef.setInput('operations', [row(1), row(2)]);
    fixture.componentRef.setInput('jobQuantity', 10);
    fixture.componentRef.setInput('now', Date.now());
    fixture.componentRef.setInput('spcCharacteristics', characteristics);
    return (fixture.componentInstance as unknown as { tiles: () => { hasSpc: boolean }[] }).tiles().map(t => t.hasSpc);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [KioskOperationTilesComponent] });
    TestBed.overrideComponent(KioskOperationTilesComponent, { set: { template: '', imports: [] } });
  });

  it('offers Record SPC only on the step that has a characteristic', () => {
    expect(hasSpc([characteristic(102)])).toEqual([false, true]);
  });

  it('offers it on every step for a part-wide characteristic', () => {
    expect(hasSpc([characteristic(null)])).toEqual([true, true]);
  });

  it('offers nothing without active characteristics', () => {
    expect(hasSpc([])).toEqual([false, false]);
    expect(hasSpc([characteristic(101, false)])).toEqual([false, false]);
  });
});
