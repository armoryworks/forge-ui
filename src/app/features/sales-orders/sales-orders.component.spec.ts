import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { SalesOrdersComponent } from './sales-orders.component';
import { SalesOrderService } from './services/sales-order.service';
import { SalesOrderListItem } from './models/sales-order-list-item.model';
import { CustomerService } from '../customers/services/customer.service';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { DraftResumeService } from '../../shared/services/draft-resume.service';
import { SelectOption } from '../../shared/components/select/select.component';

interface ListInternals {
  statusOptions: SelectOption[];
  statusFilterControl: FormControl<string | null>;
  customerFilterControl: FormControl<number | null>;
  openSalesOrderDetail(item: SalesOrderListItem): void;
}

function row(overrides: Partial<SalesOrderListItem> = {}): SalesOrderListItem {
  return {
    id: 42,
    orderNumber: 'SO-00042',
    customerId: 4,
    customerName: 'Customer',
    status: 'Confirmed',
    customerPO: null,
    lineCount: 1,
    total: 100,
    requestedDeliveryDate: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    salesOrderId: null,
    jobId: null,
    ...overrides,
  };
}

describe('SalesOrdersComponent', () => {
  let getSalesOrdersPaged: ReturnType<typeof vi.fn>;
  let detailOpen: ReturnType<typeof vi.fn>;

  function build(): ListInternals {
    return TestBed.runInInjectionContext(() => new SalesOrdersComponent()) as unknown as ListInternals;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    getSalesOrdersPaged = vi.fn(() => of({ items: [row()], totalCount: 1, page: 1, pageSize: 200 }));
    detailOpen = vi.fn(() => ({ afterClosed: () => of(undefined) }));
    TestBed.configureTestingModule({
      providers: [
        { provide: SalesOrderService, useValue: { getSalesOrdersPaged } },
        { provide: CustomerService, useValue: { getCustomers: vi.fn(() => of([])) } },
        { provide: DetailDialogService, useValue: { open: detailOpen, getDetailFromUrl: () => null } },
        { provide: DraftResumeService, useValue: { consume: () => false } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
  });

  it('offers every sales order status as a filter', () => {
    const list = build();

    expect(list.statusOptions.map(o => o.value)).toEqual([
      null, 'Draft', 'Confirmed', 'InProduction', 'PartiallyShipped', 'Shipped', 'Completed', 'Cancelled',
    ]);
  });

  it('reloads with the chosen status and customer', () => {
    const list = build();

    list.statusFilterControl.setValue('PartiallyShipped');
    expect(getSalesOrdersPaged).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'PartiallyShipped' }));

    list.customerFilterControl.setValue(4);
    expect(getSalesOrdersPaged).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'PartiallyShipped', customerId: 4 }));

    list.statusFilterControl.setValue(null);
    expect(getSalesOrdersPaged).toHaveBeenLastCalledWith(expect.objectContaining({ status: undefined, customerId: 4 }));
  });

  it('opens the sales order a row represents by its id', () => {
    const list = build();

    list.openSalesOrderDetail(row({ id: 42 }));

    expect(detailOpen).toHaveBeenCalledWith('sales-order', 42, expect.anything(), { salesOrderId: 42 });
  });
});
