import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { vi } from 'vitest';

import { ConsignmentAgreementsComponent } from './consignment-agreements.component';
import { ConsignmentService } from '../services/consignment.service';

interface PageInternals {
  rows(): { agreementId: number; stockFlagKey: string | null; statusClass: string }[];
  selected(): { agreementId: number } | null;
  transactions(): unknown[];
  select(row: unknown): void;
  onActionDone(): void;
}

const stock = (agreementId: number, belowMinimum: boolean, direction = 'Inbound') => ({
  agreementId, direction, status: 'Active', ownerName: 'Bolt Supply', partId: 3, partNumber: 'BOLT', agreedUnitPrice: 2.5,
  onHandQuantity: 10, onHandValue: 25, unbilledQuantity: 4, unbilledValue: 10, minStockQuantity: 20, maxStockQuantity: null,
  belowMinimum, aboveMaximum: false,
});

describe('ConsignmentAgreementsComponent', () => {
  const service = { stockSummary: vi.fn(), agreements: vi.fn(), transactions: vi.fn() };
  const navigate = vi.fn();
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  function create(): PageInternals {
    TestBed.configureTestingModule({
      providers: [
        { provide: ConsignmentService, useValue: service },
        { provide: Router, useValue: { navigate } },
        { provide: ActivatedRoute, useValue: { queryParamMap: params } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    return TestBed.runInInjectionContext(() => new ConsignmentAgreementsComponent()) as unknown as PageInternals;
  }

  beforeEach(() => {
    Object.values(service).forEach(fn => fn.mockReset());
    navigate.mockReset();
    service.stockSummary.mockReturnValue(of({
      totalAgreements: 3, activeAgreements: 3, totalConsignedValue: 50, totalUnbilledValue: 20,
      agreements: [stock(1, true), stock(2, false), stock(3, false, 'Outbound')],
    }));
    service.agreements.mockReturnValue(of([{ id: 1 }, { id: 2 }]));
    service.transactions.mockReturnValue(of([{ id: 9 }]));
    params = new BehaviorSubject(convertToParamMap({}));
  });

  it('lists inbound agreements with the stock flag', () => {
    const page = create();
    expect(page.rows().map(r => r.agreementId)).toEqual([1, 2]);
    expect(page.rows()[0].stockFlagKey).toBe('consignment.belowMin');
    expect(page.rows()[1].stockFlagKey).toBeNull();
    expect(page.selected()).toBeNull();
  });

  it('selects through the URL and loads the history', () => {
    const page = create();
    page.select({ agreementId: 2 });
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { agreement: 2 } }));
    params.next(convertToParamMap({ agreement: '2' }));
    expect(service.transactions).toHaveBeenCalledWith(2);
    expect(page.transactions()).toHaveLength(1);
  });

  it('reloads the stock after an action', () => {
    params.next(convertToParamMap({ agreement: '1' }));
    const page = create();
    service.stockSummary.mockClear();
    page.onActionDone();
    expect(service.stockSummary).toHaveBeenCalled();
  });
});
