import { describe, it, expect, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SubcontractOperation } from '../../models/subcontract-operation.model';
import { SubcontractOrder } from '../../models/subcontract-order.model';
import { SubcontractService } from '../../services/subcontract.service';
import { SubcontractReceiveBackDialogComponent } from '../subcontract-receive-back-dialog/subcontract-receive-back-dialog.component';
import { SubcontractSendOutDialogComponent } from '../subcontract-send-out-dialog/subcontract-send-out-dialog.component';
import { SubcontractPanelComponent } from './subcontract-panel.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

const anodize: SubcontractOperation = {
  operationId: 30, stepNumber: 20, title: 'Anodize', vendorId: 4, vendorName: 'Plating Co',
  subcontractCost: 3.1, turnTimeDays: 5, jobQuantity: 40,
};

function order(overrides: Partial<SubcontractOrder>): SubcontractOrder {
  return {
    id: 1, jobId: 7, jobNumber: 'J-1001', operationId: 30, operationName: 'Anodize',
    vendorId: 4, vendorName: 'Plating Co', purchaseOrderId: null, poNumber: null,
    quantity: 10, unitCost: 3.1, totalCost: 31, sentAt: '2026-10-01T00:00:00Z',
    expectedReturnDate: null, receivedAt: null, receivedQuantity: null, status: 'Sent',
    shippingTrackingNumber: null, returnTrackingNumber: null, notes: null, createdAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

interface PanelInternals {
  jobId: () => number;
}

function setup(orders: SubcontractOrder[], options: { capability?: boolean; roles?: string[] } = {}) {
  const getOperations = vi.fn(() => of([anodize]));
  const getOrders = vi.fn(() => of(orders));
  const open = vi.fn(() => ({ afterClosed: () => of(undefined) }));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: SubcontractService, useValue: { getOperations, getOrders } },
      { provide: CapabilityService, useValue: { isEnabled: () => options.capability ?? true } },
      { provide: AuthService, useValue: { hasAnyRole: (roles: string[]) => roles.some(r => (options.roles ?? ['Manager']).includes(r)) } },
      { provide: MatDialog, useValue: { open } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new SubcontractPanelComponent());
  (component as unknown as PanelInternals).jobId = signal(7);
  TestBed.flushEffects();
  return { component, getOperations, getOrders, open };
}

describe('SubcontractPanelComponent', () => {
  it('loads subcontracted operations and orders for the job', () => {
    const { component, getOperations, getOrders } = setup([order({})]);

    expect(getOperations).toHaveBeenCalledWith(7);
    expect(getOrders).toHaveBeenCalledWith(7);
    expect(component.visible()).toBe(true);
  });

  it('stays hidden and silent when the capability is off', () => {
    const { component, getOperations } = setup([], { capability: false });

    expect(getOperations).not.toHaveBeenCalled();
    expect(component.visible()).toBe(false);
  });

  it('stays hidden for roles the subcontract endpoints refuse', () => {
    const { component, getOperations } = setup([], { roles: ['ProductionWorker'] });

    expect(getOperations).not.toHaveBeenCalled();
    expect(component.visible()).toBe(false);
  });

  it('counts only open orders as out and receives the oldest first', () => {
    const { component } = setup([
      order({ id: 1, quantity: 10, sentAt: '2026-10-03T00:00:00Z' }),
      order({ id: 2, quantity: 5, sentAt: '2026-10-01T00:00:00Z' }),
      order({ id: 3, quantity: 8, status: 'Complete' }),
    ]);

    expect(component.outQuantity(anodize)).toBe(15);
    expect(component.oldestOpenOrder(anodize)?.id).toBe(2);
  });

  it('has no receive-back target once everything is back', () => {
    const { component } = setup([order({ status: 'Complete' }), order({ id: 2, status: 'Rejected' })]);

    expect(component.outQuantity(anodize)).toBe(0);
    expect(component.oldestOpenOrder(anodize)).toBeNull();
  });

  it('opens send-out defaulted to what the job still has to send', () => {
    const { component, open } = setup([order({ quantity: 15 })]);
    const step = { ...anodize, remainingQuantity: 25 };

    component.sendOut(step);

    expect(open).toHaveBeenCalledWith(SubcontractSendOutDialogComponent, expect.objectContaining({
      data: { jobId: 7, operation: step, defaultQuantity: 25 },
    }));
  });

  it('opens send-out with no quantity once nothing is left to send', () => {
    const { component, open } = setup([order({ quantity: 40 })]);
    const step = { ...anodize, remainingQuantity: 0 };

    component.sendOut(step);

    expect(open).toHaveBeenCalledWith(SubcontractSendOutDialogComponent, expect.objectContaining({
      data: { jobId: 7, operation: step, defaultQuantity: null },
    }));
  });

  it('does not count rejected or scrapped pieces as still out', () => {
    const { component } = setup([
      order({ quantity: 20, status: 'PartiallyReceived', receivedQuantity: 5, rejectedQuantity: 4, scrapQuantity: 1 }),
    ]);

    expect(component.outQuantity(anodize)).toBe(10);
  });

  it('opens receive-back for an order', () => {
    const sent = order({});
    const { component, open } = setup([sent]);

    component.receiveBack(sent);

    expect(open).toHaveBeenCalledWith(SubcontractReceiveBackDialogComponent, expect.objectContaining({ data: { order: sent } }));
  });

  it('labels every status', () => {
    const { component } = setup([]);

    expect(component.statusLabelKey('QcPending')).toBe('subcontractUi.status.qcPending');
    expect(component.statusChipClass('Rejected')).toContain('chip--error');
  });
});
