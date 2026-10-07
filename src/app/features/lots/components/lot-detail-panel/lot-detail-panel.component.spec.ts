import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { LotService } from '../../services/lot.service';
import { LotTrace, LotTraceEvent } from '../../models/lot-trace.model';
import { LotDetailPanelComponent } from './lot-detail-panel.component';

function event(overrides: Partial<LotTraceEvent>): LotTraceEvent {
  return {
    type: 'QcInspection',
    referenceNumber: 'QC #1',
    description: 'InProgress',
    date: new Date('2026-09-01'),
    quantity: null,
    ...overrides,
  };
}

const TRACE: LotTrace = {
  lotNumber: 'LOT-1',
  partNumber: 'P-1',
  partDescription: 'Bracket',
  quantity: 10,
  expirationDate: null,
  supplierLotNumber: null,
  events: [],
  shippedTo: [
    { shipmentId: 3, shipmentNumber: 'SHP-3', customerId: 9, customerName: 'Downstream Buyer', shippedDate: new Date('2026-09-02'), quantity: 4 },
  ],
};

interface PanelInternals {
  trace: () => LotTrace | null;
  statusKey: (e: LotTraceEvent) => string | null;
}

function setup(): { panel: PanelInternals; trace: ReturnType<typeof vi.fn> } {
  const trace = vi.fn(() => of(TRACE));
  TestBed.configureTestingModule({
    providers: [
      { provide: LotService, useValue: { trace } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new LotDetailPanelComponent());
  mockSignalInputs(component, { lotId: 1, lotNumber: 'LOT-1' });
  TestBed.tick();
  return { panel: component as unknown as PanelInternals, trace };
}

describe('LotDetailPanelComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the trace including the customers the lot shipped to', () => {
    const { panel, trace } = setup();

    expect(trace).toHaveBeenCalledWith('LOT-1');
    expect(panel.trace()?.shippedTo?.[0].customerName).toBe('Downstream Buyer');
  });

  it('translates inspection status codes with the quality status keys', () => {
    const { panel } = setup();

    expect(panel.statusKey(event({ statusCode: 'InProgress' }))).toBe('quality.statusInProgress');
    expect(panel.statusKey(event({ statusCode: 'Failed', actor: 'Pat Inspector' }))).toBe('quality.statusFailed');
  });

  it('translates production-run status codes with the status keys', () => {
    const { panel } = setup();

    expect(panel.statusKey(event({ type: 'ProductionRun', statusCode: 'Planned' }))).toBe('status.planned');
    expect(panel.statusKey(event({ type: 'ProductionRun', statusCode: 'Completed' }))).toBe('status.completed');
  });

  it('falls back to the description when there is no known status code', () => {
    const { panel } = setup();

    expect(panel.statusKey(event({ type: 'Job', statusCode: null }))).toBeNull();
    expect(panel.statusKey(event({ statusCode: 'Unknown' }))).toBeNull();
  });
});
