import { Signal, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';

import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { PurchaseOrderDetail } from '../../purchase-orders/models/purchase-order-detail.model';
import { PurchaseOrderLine } from '../../purchase-orders/models/purchase-order-line.model';
import { SILENT_HTTP_ERRORS } from '../../../shared/interceptors/silent-http-errors.token';
import { CapabilityService } from '../../../shared/services/capability.service';
import { InstanceService } from '../../../shared/services/instance.service';
import { SharedIdentityService } from '../../../shared/services/shared-identity.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { AppReceiveComponent } from './app-receive.component';

interface ReceiveInternals {
  form: FormGroup<{
    packingSlip: FormControl<string>;
    lines: FormArray<FormGroup<{
      quantity: FormControl<number | null>;
      binId: FormControl<number | null>;
      lot: FormControl<string>;
    }>>;
  }>;
  lines: Signal<PurchaseOrderLine[]>;
  loading: Signal<boolean>;
  canSubmit: Signal<boolean>;
  identifying: Signal<boolean>;
  error: Signal<string | null>;
  lineBinOptions: Signal<{ value: unknown; label: string }[][]>;
  submit(): void;
  fillRemaining(index: number): void;
  onIdentified(): void;
}

function line(overrides: Partial<PurchaseOrderLine>): PurchaseOrderLine {
  return {
    id: 1, partId: 10, partNumber: 'BAR-4140', description: '4140 round bar',
    orderedQuantity: 40, receivedQuantity: 15, remainingQuantity: 25, unbilledReceivedQuantity: 0,
    cancelledShortCloseQuantity: 0, unitPrice: 12, lineTotal: 480, notes: null,
    purchaseUnitId: null, purchaseUnitLabel: null, manualOverrideReason: null,
    partDefaultBinId: 5, partDefaultBinPath: 'Dock / Rack A / 1',
    ...overrides,
  };
}

function purchaseOrder(overrides: Partial<PurchaseOrderDetail> = {}): PurchaseOrderDetail {
  return {
    id: 7, poNumber: 'PO-0007', vendorId: 3, vendorName: 'Steel vendor', jobId: null, jobNumber: null,
    status: 'PartiallyReceived', submittedDate: null, acknowledgedDate: null, expectedDeliveryDate: null,
    receivedDate: null, notes: null, isBlanket: false, blanketTotalQuantity: null, blanketReleasedQuantity: null,
    blanketRemainingQuantity: null, blanketExpirationDate: null, agreedUnitPrice: null,
    lines: [
      line({}),
      line({ id: 2, partId: null, partNumber: null, description: 'Freight', remainingQuantity: 1, orderedQuantity: 1, receivedQuantity: 0 }),
      line({ id: 3, remainingQuantity: 0, receivedQuantity: 40 }),
    ],
    createdAt: new Date(), updatedAt: new Date(), shortCloseReason: null, shortClosedAt: null,
    incoterm: 'FOB_Origin', estimatedFreight: null, quoteCurrency: 'USD', fxRate: null, fxRateSource: null,
    belowVendorMinimum: false, vendorMinimumOrderAmount: null, originSource: 'Manual',
    originUserName: null, originReference: null,
    ...overrides,
  };
}

describe('AppReceiveComponent', () => {
  let http: HttpTestingController;
  let shared: boolean;
  const success = vi.fn();
  const identity = { identified: signal(true), touch: vi.fn() };

  beforeEach(() => {
    shared = false;
    success.mockReset();
    identity.identified.set(true);
    identity.touch.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '7' })) } },
        { provide: Router, useValue: { navigateByUrl: vi.fn().mockResolvedValue(true) } },
        { provide: CapabilityService, useValue: { isEnabled: () => true } },
        { provide: SnackbarService, useValue: { success, error: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SharedIdentityService, useValue: identity },
        { provide: InstanceService, useValue: { instance: () => ({ id: 'shop', shared }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    http.verify();
  });

  async function create(po: PurchaseOrderDetail = purchaseOrder()): Promise<ReceiveInternals> {
    const component = TestBed.runInInjectionContext(() => new AppReceiveComponent());
    const internals = component as unknown as ReceiveInternals;
    http.expectOne('/api/v1/purchase-orders/7').flush(po);
    const bins = http.expectOne((req) => req.url === '/api/v1/inventory/locations/bins');
    expect(bins.request.params.get('activeOnly')).toBe('true');
    bins.flush({ items: [{ id: 9, name: 'B2', locationType: 'Bin', barcode: null, locationPath: 'Dock / Rack B / 2', isActive: true }] });
    await vi.waitFor(() => expect(internals.loading()).toBe(false));
    return internals;
  }

  it('lists only the open lines, each with the active bins and its own default bin', async () => {
    const receive = await create();

    expect(receive.lines().map((l) => l.id)).toEqual([1, 2]);
    expect(receive.form.controls.lines.at(0).controls.binId.value).toBe(5);
    expect(receive.lineBinOptions()[0].map((o) => o.value)).toEqual([null, 9, 5]);
    expect(receive.canSubmit()).toBe(false);
  });

  it('posts the quantity, bin, lot and packing slip and reloads the PO', async () => {
    const receive = await create();
    const first = receive.form.controls.lines.at(0);
    first.setValue({ quantity: 25, binId: 9, lot: '  HT-88812 ' });
    receive.form.controls.packingSlip.setValue(' PS-1001 ');

    expect(receive.canSubmit()).toBe(true);
    receive.submit();

    const post = http.expectOne('/api/v1/purchase-orders/7/receive');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({
      lines: [{ lineId: 1, quantity: 25, storageLocationId: 9, lotNumber: 'HT-88812' }],
      packingSlipNumber: 'PS-1001',
    });
    expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(post.request.context.get(SILENT_HTTP_ERRORS)).toBe(true);
    post.flush(null);

    await vi.waitFor(() => expect(success).toHaveBeenCalledWith('mobileReceive.received'));
    http.expectOne('/api/v1/purchase-orders/7').flush(purchaseOrder({
      lines: [line({ remainingQuantity: 0, receivedQuantity: 40 })],
    }));
    http.expectOne((req) => req.url === '/api/v1/inventory/locations/bins').flush({ items: [] });
    await vi.waitFor(() => expect(receive.lines()).toEqual([]));
    expect(identity.touch).toHaveBeenCalled();
  });

  it('sends a non-stock line without bin or lot and leaves an empty packing slip null', async () => {
    const receive = await create();
    receive.fillRemaining(1);
    receive.submit();

    const post = http.expectOne('/api/v1/purchase-orders/7/receive');
    expect(post.request.body).toEqual({
      lines: [{ lineId: 2, quantity: 1, storageLocationId: null, lotNumber: null }],
      packingSlipNumber: null,
    });
    post.flush(null);
    await vi.waitFor(() => expect(success).toHaveBeenCalled());
    http.expectOne('/api/v1/purchase-orders/7').flush(purchaseOrder());
    http.expectOne((req) => req.url === '/api/v1/inventory/locations/bins').flush({ items: [] });
  });

  it('shows the server message when the receipt is refused', async () => {
    const receive = await create();
    receive.form.controls.lines.at(0).controls.quantity.setValue(20);
    receive.submit();

    http.expectOne('/api/v1/purchase-orders/7/receive').flush(
      { title: 'Action not allowed', detail: 'Cannot receive 20 — only 5 remaining' },
      { status: 409, statusText: 'Conflict' },
    );

    await vi.waitFor(() => expect(receive.error()).toBe('Cannot receive 20 — only 5 remaining'));
    expect(success).not.toHaveBeenCalled();
  });

  it('blocks a quantity above what is still due', async () => {
    const receive = await create();
    receive.form.controls.lines.at(0).controls.quantity.setValue(26);

    expect(receive.canSubmit()).toBe(false);
  });

  it('does not submit while offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const receive = await create();
    receive.form.controls.lines.at(0).controls.quantity.setValue(5);

    expect(receive.canSubmit()).toBe(false);
    receive.submit();
    http.expectNone('/api/v1/purchase-orders/7/receive');
  });

  it('on a shared device, asks who is receiving before posting', async () => {
    shared = true;
    identity.identified.set(false);
    const receive = await create();
    receive.form.controls.lines.at(0).controls.quantity.setValue(5);

    receive.submit();
    expect(receive.identifying()).toBe(true);
    http.expectNone('/api/v1/purchase-orders/7/receive');

    identity.identified.set(true);
    receive.onIdentified();
    http.expectOne('/api/v1/purchase-orders/7/receive').flush(null);
    await vi.waitFor(() => expect(success).toHaveBeenCalled());
    http.expectOne('/api/v1/purchase-orders/7').flush(purchaseOrder());
    http.expectOne((req) => req.url === '/api/v1/inventory/locations/bins').flush({ items: [] });
  });

  it('offers no receive form for a PO that is not open for receiving', async () => {
    const receive = await create(purchaseOrder({ status: 'Draft' }));
    receive.form.controls.lines.at(0).controls.quantity.setValue(5);

    expect(receive.canSubmit()).toBe(false);
  });
});
