import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of, throwError } from 'rxjs';

import { RoutingComponent } from './routing.component';
import { PartsService } from '../../services/parts.service';
import { Operation } from '../../models/operation.model';
import { DraftResumeService } from '../../../../shared/services/draft-resume.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { PendingChangesService } from '../../../../shared/services/pending-changes.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface RoutingInternals {
  expandedInstructions(): ReadonlySet<number>;
  toggleInstructions(operationId: number): void;
  operations: { (): Operation[]; set(value: Operation[]): void };
  totalCycleMs(): number;
  totalSetupMs(): number;
  totalLotMs(): number;
  openCopyRouting(): void;
  onReorderOperation(event: { previousIndex: number; currentIndex: number }): void;
  followsByOperation(): Map<number, string>;
  gatingControl: { setValue(value: string | null): void; disabled: boolean };
  canEditSteps: boolean;
  deadEnds(): Set<number>;
  version: { (): string | null; set(value: string | null): void };
}

function operation(id: number, stepNumber: number, estimatedMs: number | null, setupMinutes: number, runMinutesLot: number): Operation {
  return {
    id, partId: 1, stepNumber, title: `Step ${stepNumber}`, instructions: null,
    workCenterId: null, workCenterName: null, estimatedMs, setupMinutes, runMinutesLot,
    isQcCheckpoint: false, qcCriteria: null, referencedOperationId: null, referencedOperationTitle: null,
    materials: [], createdAt: new Date(), updatedAt: new Date(),
    isSubcontract: false, subcontractVendorId: null, subcontractVendorName: null, subcontractTurnTimeDays: null,
    scrapFactor: 0,
  };
}

function setup(dialogOpen = vi.fn(), partsService: Record<string, unknown> = {}, roles = ['Engineer']): RoutingInternals {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: MatDialog, useValue: { open: dialogOpen } },
      { provide: PartsService, useValue: { getRoutingGraph: vi.fn(() => of({ version: 'v2', operations: [] })), ...partsService } },
      { provide: DraftResumeService, useValue: { consume: vi.fn(() => false) } },
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new RoutingComponent());
  Object.defineProperty(component, 'partId', { value: () => 7 });
  return component as unknown as RoutingInternals;
}

describe('RoutingComponent — instruction expansion', () => {
  it('starts with every card collapsed', () => {
    expect(setup().expandedInstructions().size).toBe(0);
  });

  it('expands and collapses each card independently', () => {
    const component = setup();

    component.toggleInstructions(1);
    component.toggleInstructions(2);
    expect([...component.expandedInstructions()]).toEqual([1, 2]);

    component.toggleInstructions(1);
    expect(component.expandedInstructions().has(1)).toBe(false);
    expect(component.expandedInstructions().has(2)).toBe(true);
  });

  it('replaces the set on each toggle so signal consumers see the change', () => {
    const component = setup();
    const before = component.expandedInstructions();

    component.toggleInstructions(5);

    expect(component.expandedInstructions()).not.toBe(before);
    expect(before.has(5)).toBe(false);
  });
});

describe('RoutingComponent — totals and copy', () => {
  it('totals the cycle time per piece, setup and per-lot time across every step', () => {
    const component = setup();

    component.operations.set([
      operation(1, 1, 8_500, 15, 2.5),
      operation(2, 2, null, 0, 0),
      operation(3, 3, 63_500, 5, 0.5),
    ]);

    expect(component.totalCycleMs()).toBe(72_000);
    expect(component.totalSetupMs()).toBe(20 * 60_000);
    expect(component.totalLotMs()).toBe(3 * 60_000);
  });

  it('shows the copied routing in step order once the copy dialog returns it', () => {
    const copied = [operation(12, 20, 1000, 0, 0), operation(11, 10, 1000, 0, 0)];
    const dialogOpen = vi.fn(() => ({ afterClosed: () => of(copied) }));
    const component = setup(dialogOpen, { getRoutingGraph: vi.fn(() => of({ version: 'v3', operations: copied })) });

    component.openCopyRouting();

    expect(dialogOpen).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ data: { partId: 7 } }));
    expect(component.operations().map(op => op.id)).toEqual([11, 12]);
  });

  it('leaves the routing empty when the copy dialog is cancelled', () => {
    const component = setup(vi.fn(() => ({ afterClosed: () => of(null) })));

    component.openCopyRouting();

    expect(component.operations()).toEqual([]);
  });
});

describe('RoutingComponent — step links and gating', () => {
  function conflict(): HttpErrorResponse {
    return new HttpErrorResponse({
      status: 409,
      error: { code: 'predecessor-conflict', conflicts: [{ operationId: 3, stepNumber: 10, predecessorOperationId: 1, predecessorStepNumber: 20 }] },
    });
  }

  it('saves a drag as one reorder that keeps the step numbers', () => {
    const saved = [operation(2, 10, null, 0, 0), operation(1, 20, null, 0, 0)];
    const reorderOperations = vi.fn(() => of(saved));
    const component = setup(vi.fn(), { reorderOperations, getRoutingGraph: vi.fn(() => of({ version: 'v3', operations: saved })) });
    component.operations.set([operation(1, 10, null, 0, 0), operation(2, 20, null, 0, 0)]);

    component.onReorderOperation({ previousIndex: 1, currentIndex: 0 });

    expect(reorderOperations).toHaveBeenCalledWith(7, { operationIds: [2, 1], removeConflictingPredecessors: false, routingVersion: null });
    expect(component.operations().map(op => [op.id, op.stepNumber])).toEqual([[2, 10], [1, 20]]);
  });

  it('asks before removing links a reorder breaks, then saves again without them', () => {
    const reorderOperations = vi.fn()
      .mockReturnValueOnce(throwError(() => conflict()))
      .mockReturnValueOnce(of([]));
    const dialogOpen = vi.fn(() => ({ afterClosed: () => of(true) }));
    const component = setup(dialogOpen, { reorderOperations });
    component.operations.set([operation(1, 10, null, 0, 0), operation(3, 20, null, 0, 0)]);

    component.onReorderOperation({ previousIndex: 1, currentIndex: 0 });

    expect(dialogOpen).toHaveBeenCalledTimes(1);
    expect(reorderOperations).toHaveBeenLastCalledWith(7, { operationIds: [3, 1], removeConflictingPredecessors: true, routingVersion: null });
  });

  it('labels only the steps whose links differ from the previous step', () => {
    const component = setup();
    component.operations.set([
      operation(1, 10, null, 0, 0),
      { ...operation(2, 20, null, 0, 0), predecessors: [{ operationId: 1, stepNumber: 10, gate: 'Quantity' }] },
      { ...operation(3, 30, null, 0, 0), predecessors: [{ operationId: 1, stepNumber: 10, gate: 'Complete' }] },
      operation(4, 40, null, 0, 0),
    ]);

    const follows = component.followsByOperation();

    expect(follows.has(1)).toBe(false);
    expect(follows.get(2)).toBe('Op 10');
    expect(follows.get(3)).toBe('parts.followsDone');
    expect(follows.has(4)).toBe(false);
  });

  it('saves the part step gating when it changes', () => {
    const updateStepGating = vi.fn(() => of(void 0));
    const component = setup(vi.fn(), { updateStepGating });

    component.gatingControl.setValue('Block');

    expect(updateStepGating).toHaveBeenCalledWith(7, 'Block');
  });

  it('shows step gating read-only to roles that cannot edit routings', () => {
    const component = setup(vi.fn(), {}, ['ProductionWorker']);

    expect(component.gatingControl.disabled).toBe(true);
  });
});

describe('RoutingComponent — flow editor', () => {
  interface FlowInternals {
    canEditFlow: boolean;
    flowDirty: { (): boolean; set(value: boolean): void };
    routingViewMode(): string;
    showView(mode: 'list' | 'flow'): void;
    onFlowSaved(operations: Operation[]): void;
    operations(): Operation[];
  }

  it('lets engineers, managers and admins edit the flow, and not other roles', () => {
    expect((setup(vi.fn(), {}, ['Engineer']) as unknown as FlowInternals).canEditFlow).toBe(true);
    expect((setup(vi.fn(), {}, ['ProductionWorker']) as unknown as FlowInternals).canEditFlow).toBe(false);
  });

  it('asks before leaving the flow with unsaved changes and stays when the user declines', () => {
    const open = vi.fn(() => ({ afterClosed: () => of(false) }));
    const component = setup(open) as unknown as FlowInternals;
    component.showView('flow');
    component.flowDirty.set(true);

    component.showView('list');

    expect(open).toHaveBeenCalledTimes(1);
    expect(component.routingViewMode()).toBe('flow');
  });

  it('switches without asking when nothing is unsaved, and takes the saved order from the editor', () => {
    const open = vi.fn();
    const saved = [operation(2, 20, null, 0, 0), operation(1, 10, null, 0, 0)];
    const component = setup(open, { getRoutingGraph: vi.fn(() => of({ version: 'v3', operations: saved })) }) as unknown as FlowInternals;
    component.showView('flow');

    component.onFlowSaved(saved);
    component.showView('list');

    expect(open).not.toHaveBeenCalled();
    expect(component.routingViewMode()).toBe('list');
    expect(component.operations().map(op => op.id)).toEqual([1, 2]);
  });
});

describe('RoutingComponent — overwrite protection, edit parity and dead ends', () => {
  function stale(): HttpErrorResponse {
    return new HttpErrorResponse({ status: 409, error: { code: 'routing-graph-stale', version: 'v9' } });
  }

  it('sends the routing version it opened with a reorder', () => {
    const reorderOperations = vi.fn(() => of([]));
    const component = setup(vi.fn(), { reorderOperations });
    component.version.set('v1');
    component.operations.set([operation(1, 10, null, 0, 0), operation(2, 20, null, 0, 0)]);

    component.onReorderOperation({ previousIndex: 1, currentIndex: 0 });

    expect(reorderOperations).toHaveBeenCalledWith(7, { operationIds: [2, 1], removeConflictingPredecessors: false, routingVersion: 'v1' });
  });

  it('shows the routing the new version belongs to after a reorder', () => {
    const reorderOperations = vi.fn(() => of([operation(2, 10, null, 0, 0), operation(1, 20, null, 0, 0)]));
    const latest = [operation(2, 10, null, 0, 0), operation(1, 20, null, 0, 0), operation(3, 30, null, 0, 0)];
    const component = setup(vi.fn(), { reorderOperations, getRoutingGraph: vi.fn(() => of({ version: 'v4', operations: latest })) });
    component.operations.set([operation(1, 10, null, 0, 0), operation(2, 20, null, 0, 0)]);

    component.onReorderOperation({ previousIndex: 1, currentIndex: 0 });

    expect(component.version()).toBe('v4');
    expect(component.operations().map(op => op.id)).toEqual([2, 1, 3]);
  });

  it('asks to reload when someone else changed the routing, and reloads it', () => {
    const reorderOperations = vi.fn(() => throwError(() => stale()));
    const getRoutingGraph = vi.fn(() => of({ version: 'v9', operations: [operation(5, 10, null, 0, 0)] }));
    const dialogOpen = vi.fn(() => ({ afterClosed: () => of(true) }));
    const component = setup(dialogOpen, { reorderOperations, getRoutingGraph });
    component.version.set('v1');
    component.operations.set([operation(1, 10, null, 0, 0), operation(2, 20, null, 0, 0)]);

    component.onReorderOperation({ previousIndex: 1, currentIndex: 0 });

    expect(dialogOpen).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      data: expect.objectContaining({ title: 'routingGraph.staleTitle' }),
    }));
    expect(component.version()).toBe('v9');
    expect(component.operations().map(op => op.id)).toEqual([5]);
  });

  it('keeps production workers out of list editing as well as the flowchart', () => {
    const reorderOperations = vi.fn(() => of([]));
    const component = setup(vi.fn(), { reorderOperations }, ['ProductionWorker']);
    component.operations.set([operation(1, 10, null, 0, 0), operation(2, 20, null, 0, 0)]);

    component.onReorderOperation({ previousIndex: 1, currentIndex: 0 });

    expect(component.canEditSteps).toBe(false);
    expect(reorderOperations).not.toHaveBeenCalled();
  });

  it('flags a step no later step follows, but not the final step', () => {
    const component = setup();
    component.operations.set([
      operation(1, 10, null, 0, 0),
      operation(2, 20, null, 0, 0),
      { ...operation(3, 30, null, 0, 0), predecessors: [{ operationId: 1, stepNumber: 10, gate: 'Quantity' }] },
    ]);

    expect([...component.deadEnds()]).toEqual([2]);
  });

  it('marks unsaved flowchart edits as pending so leaving the page or tab asks first', () => {
    const component = setup() as unknown as RoutingInternals & { flowDirty: { set(value: boolean): void } };
    const pending = TestBed.inject(PendingChangesService);

    component.flowDirty.set(true);
    TestBed.flushEffects();
    expect(pending.hasPending()).toBe(true);

    component.flowDirty.set(false);
    TestBed.flushEffects();
    expect(pending.hasPending()).toBe(false);
  });
});
