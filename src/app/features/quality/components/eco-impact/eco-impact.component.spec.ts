import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { EcoImpactComponent } from './eco-impact.component';
import { EcoService } from '../../services/eco.service';
import { EcoImpact } from '../../models/eco-impact.model';
import { EntityPreviewService } from '../../../../shared/services/entity-preview.service';

const IMPACT: EcoImpact = {
  ecoId: 4,
  parts: [{
    partId: 10, partNumber: 'BRK-10', partName: 'Bracket', currentRevision: 'C',
    openJobs: [
      { jobId: 1, jobNumber: 'J-1', title: 'Bracket run', partId: 10, partNumber: 'BRK-10', partRevision: 'B', stageName: 'Machining', dueDate: null, relation: 'Direct' },
      { jobId: 2, jobNumber: 'J-2', title: 'Assembly', partId: 11, partNumber: 'ASM-11', partRevision: null, stageName: null, dueDate: null, relation: 'WhereUsed' },
    ],
    openPurchaseOrderLines: [{ purchaseOrderId: 5, poNumber: 'PO-5', lineId: 50, vendorName: 'Steel Co', openQuantity: 30, status: 'Submitted' }],
    openSalesOrderLines: [],
    stockByRevision: [{ revision: 'B', quantity: 8, lotCount: 1 }, { revision: null, quantity: 3, lotCount: 0 }],
  }],
};

describe('EcoImpactComponent', () => {
  let getImpact: ReturnType<typeof vi.fn>;

  function render() {
    TestBed.configureTestingModule({
      imports: [EcoImpactComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: EcoService, useValue: { getImpact } },
        { provide: EntityPreviewService, useValue: { getPreview: vi.fn(() => of(null)) } },
      ],
    });
    const fixture = TestBed.createComponent(EcoImpactComponent);
    fixture.componentRef.setInput('ecoId', 4);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('lists the open jobs, orders and stock by revision for each affected part', () => {
    getImpact = vi.fn(() => of(IMPACT));
    const el = render();

    expect(getImpact).toHaveBeenCalledWith(4);
    expect(el.querySelector('[data-testid="eco-impact-job-1"]')?.textContent).toContain('J-1');
    expect(el.querySelector('[data-testid="eco-impact-job-2"]')?.textContent).toContain('ecoImpact.usedIn');
    expect(el.querySelector('[data-testid="eco-impact-po-50"]')?.textContent).toContain('PO-5');
    expect(el.querySelector('[data-testid="eco-impact-stock-B"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="eco-impact-stock-none"]')).not.toBeNull();
  });

  it('reloads the impact when the ECO gains an affected item', () => {
    getImpact = vi.fn(() => of(IMPACT));
    TestBed.configureTestingModule({
      imports: [EcoImpactComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: EcoService, useValue: { getImpact } },
        { provide: EntityPreviewService, useValue: { getPreview: vi.fn(() => of(null)) } },
      ],
    });
    const fixture = TestBed.createComponent(EcoImpactComponent);
    fixture.componentRef.setInput('ecoId', 4);
    fixture.componentRef.setInput('affectedItemCount', 1);
    fixture.detectChanges();
    expect(getImpact).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('affectedItemCount', 2);
    fixture.detectChanges();

    expect(getImpact).toHaveBeenCalledTimes(2);
  });

  it('offers a retry when the impact cannot be loaded', () => {
    getImpact = vi.fn(() => throwError(() => new Error('down')));
    const el = render();

    expect(el.querySelector('[data-testid="eco-impact-failed"]')).not.toBeNull();
    (el.querySelector('[data-testid="eco-impact-retry-btn"]') as HTMLButtonElement).click();
    expect(getImpact).toHaveBeenCalledTimes(2);
  });
});
