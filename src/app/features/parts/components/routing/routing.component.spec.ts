import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';

import { RoutingComponent } from './routing.component';
import { PartsService } from '../../services/parts.service';
import { Operation } from '../../models/operation.model';
import { DraftResumeService } from '../../../../shared/services/draft-resume.service';

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
}

function operation(id: number, stepNumber: number, estimatedMs: number | null, setupMinutes: number, runMinutesLot: number): Operation {
  return {
    id, partId: 1, stepNumber, title: `Step ${stepNumber}`, instructions: null,
    workCenterId: null, workCenterName: null, estimatedMs, setupMinutes, runMinutesLot,
    isQcCheckpoint: false, qcCriteria: null, referencedOperationId: null, referencedOperationTitle: null,
    materials: [], createdAt: new Date(), updatedAt: new Date(),
    isSubcontract: false, subcontractVendorId: null, subcontractVendorName: null, subcontractTurnTimeDays: null,
  };
}

function setup(dialogOpen = vi.fn()): RoutingInternals {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: MatDialog, useValue: { open: dialogOpen } },
      { provide: PartsService, useValue: { getOperations: vi.fn(() => of([])) } },
      { provide: DraftResumeService, useValue: { consume: vi.fn(() => false) } },
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
    const component = setup(dialogOpen);

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
