import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ScanLogEntry } from '../../../../shared/models/scan-log.model';
import { ScanActionService } from '../../../../shared/services/scan-action.service';
import { ScanDailyLogComponent } from './scan-daily-log.component';

function entry(id: number, actionType: string): ScanLogEntry {
  return {
    id,
    actionType,
    userName: 'Operator',
    partNumber: 'P-1',
    quantity: 1,
    fromLocation: null,
    toLocation: null,
    relatedEntity: null,
    isReversed: false,
    createdAt: '2026-10-08T10:00:00Z',
  };
}

function setup() {
  TestBed.configureTestingModule({
    providers: [
      { provide: ScanActionService, useValue: { getScanLog: vi.fn(() => of([])) } },
      {
        provide: TranslateService,
        useValue: {
          instant: (key: string, params?: Record<string, unknown>) =>
            params ? `${key} ${JSON.stringify(params)}` : `es:${key}`,
        },
      },
    ],
  });
  return TestBed.runInInjectionContext(() => new ScanDailyLogComponent());
}

describe('ScanDailyLogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('translates the column headers and the action filter', () => {
    const log = setup();

    expect(log.columns.map(c => c.header)).toEqual([
      'es:kioskFlows.dailyLog.columns.time',
      'es:kioskFlows.dailyLog.columns.action',
      'es:kioskFlows.dailyLog.columns.part',
      'es:kioskFlows.dailyLog.columns.qty',
      'es:kioskFlows.dailyLog.columns.from',
      'es:kioskFlows.dailyLog.columns.to',
      'es:kioskFlows.dailyLog.columns.related',
      'es:kioskFlows.dailyLog.columns.status',
    ]);
    expect(log.actionTypeOptions).toEqual([
      { value: null, label: 'es:kioskFlows.dailyLog.all' },
      { value: 'Move', label: 'es:kioskFlows.logActions.move' },
      { value: 'CycleCount', label: 'es:kioskFlows.logActions.cycleCount' },
      { value: 'Receive', label: 'es:kioskFlows.logActions.receive' },
      { value: 'Ship', label: 'es:kioskFlows.logActions.ship' },
      { value: 'Issue', label: 'es:kioskFlows.logActions.issue' },
    ]);
  });

  it('builds the summary from translated counts', () => {
    const log = setup();
    log.entries.set([entry(1, 'Move'), entry(2, 'Move'), entry(3, 'CycleCount')]);

    expect(log.summaryText()).toBe(
      'kioskFlows.dailyLog.moves {"count":2}, kioskFlows.dailyLog.counts {"count":1}',
    );
  });

  it('labels work order scans and falls back to the raw type for unknown ones', () => {
    const log = setup();

    expect(log.actionTypeLabel('JobAdvance')).toBe('es:kioskFlows.logActions.jobAdvance');
    expect(log.actionTypeLabel('Teleport')).toBe('Teleport');
  });
});
