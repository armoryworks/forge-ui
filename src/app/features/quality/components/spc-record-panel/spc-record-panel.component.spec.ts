import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { SpcCharacteristic } from '../../models/spc.model';
import { spcForOperation } from '../../utils/spc-for-operation';
import { SpcRecordPanelComponent } from './spc-record-panel.component';

interface PanelInternals {
  chosen: () => SpcCharacteristic[];
  choose(characteristic: SpcCharacteristic): void;
}

const od = { id: 1, name: 'OD', operationId: 30, isActive: true } as SpcCharacteristic;
const length = { id: 2, name: 'Length', operationId: null, isActive: true } as SpcCharacteristic;

function panel(characteristics: SpcCharacteristic[]): PanelInternals {
  const component = TestBed.runInInjectionContext(() => new SpcRecordPanelComponent());
  mockSignalInputs(component, { characteristics, jobId: 5 });
  return component as unknown as PanelInternals;
}

describe('SpcRecordPanelComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('goes straight to entry when the step has one characteristic', () => {
    expect(panel([od]).chosen()).toEqual([od]);
  });

  it('asks which characteristic when there are several, then enters for the one picked', () => {
    const p = panel([od, length]);

    expect(p.chosen()).toEqual([]);
    p.choose(length);
    expect(p.chosen()).toEqual([length]);
  });
});

describe('spcForOperation', () => {
  it('takes the step\'s own and the part-wide characteristics, active only', () => {
    const retired = { id: 3, operationId: 30, isActive: false } as SpcCharacteristic;
    const other = { id: 4, operationId: 40, isActive: true } as SpcCharacteristic;

    expect(spcForOperation([od, length, retired, other], 30).map(c => c.id)).toEqual([1, 2]);
    expect(spcForOperation([od, length], null)).toEqual([]);
  });
});
