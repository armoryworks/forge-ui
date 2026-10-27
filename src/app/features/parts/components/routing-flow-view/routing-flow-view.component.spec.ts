import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { RoutingFlowViewComponent } from './routing-flow-view.component';
import { Operation } from '../../models/operation.model';

class FlowLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({ parts: { followsTag: 'After Op {{steps}}' } });
  }
}

function op(id: number, stepNumber: number, predecessors: Operation['predecessors'] = []): Operation {
  return {
    id, partId: 1, stepNumber, title: `Step ${stepNumber}`, instructions: null, workCenterId: null, workCenterName: null,
    estimatedMs: null, setupMinutes: 0, runMinutesLot: 0, scrapFactor: 0, isQcCheckpoint: false, qcCriteria: null,
    referencedOperationId: null, referencedOperationTitle: null, materials: [], createdAt: new Date(), updatedAt: new Date(),
    isSubcontract: false, subcontractVendorId: null, subcontractVendorName: null, subcontractTurnTimeDays: null, predecessors,
  };
}

describe('RoutingFlowViewComponent', () => {
  it('draws parallel steps in one column and the join after them', () => {
    TestBed.configureTestingModule({
      imports: [RoutingFlowViewComponent],
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: FlowLoader }, fallbackLang: 'en', lang: 'en' })],
    });
    const after10 = [{ operationId: 1, stepNumber: 10, gate: 'Quantity' as const }];
    const fixture = TestBed.createComponent(RoutingFlowViewComponent);
    fixture.componentRef.setInput('operations', [
      op(1, 10), op(2, 20, after10), op(3, 30, after10),
      op(4, 40, [{ operationId: 2, stepNumber: 20, gate: 'Quantity' }, { operationId: 3, stepNumber: 30, gate: 'Quantity' }]),
    ]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const column = (n: number) => [...el.querySelectorAll(`[data-testid="routing-flow-column-${n}"] [role="listitem"]`)]
      .map(node => node.getAttribute('data-testid'));
    expect(column(0)).toEqual(['routing-flow-op-10']);
    expect(column(1)).toEqual(['routing-flow-op-20', 'routing-flow-op-30']);
    expect(column(2)).toEqual(['routing-flow-op-40']);
    expect(el.querySelector('[data-testid="routing-flow-follows-40"]')?.textContent).toContain('After Op 20, 30');
  });

  it('flags a step that does not lead to a later step', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [RoutingFlowViewComponent],
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: FlowLoader }, fallbackLang: 'en', lang: 'en' })],
    });
    const after10 = [{ operationId: 1, stepNumber: 10, gate: 'Quantity' as const }];
    const fixture = TestBed.createComponent(RoutingFlowViewComponent);
    fixture.componentRef.setInput('operations', [
      op(1, 10), op(2, 20, after10), op(3, 30, after10), op(4, 40, [{ operationId: 3, stepNumber: 30, gate: 'Quantity' }]),
    ]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="routing-flow-dead-end-20"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="routing-flow-dead-end-30"]')).toBeNull();
    expect(el.querySelector('[data-testid="routing-flow-dead-end-40"]')).toBeNull();
  });
});
