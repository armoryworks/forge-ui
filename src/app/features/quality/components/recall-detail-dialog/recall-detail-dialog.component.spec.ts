import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { RecallDetailDialogComponent } from './recall-detail-dialog.component';
import { RecallService } from '../../services/recall.service';
import { RecallDetail } from '../../models/recall-detail.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { UserPreferencesService } from '../../../../shared/services/user-preferences.service';

function recall(overrides: Partial<RecallDetail> = {}): RecallDetail {
  return {
    id: 4,
    initiatedLotId: 12,
    initiatedLotNumber: 'LOT-12',
    reason: 'Contaminated resin',
    recallDate: new Date('2026-10-01'),
    status: 'Active',
    affectedLotsCount: 2,
    affectedShipmentsCount: 2,
    totalQuarantinedQuantity: 30,
    resolvedAt: null,
    createdAt: new Date('2026-10-01'),
    resolutionNotes: null,
    affectedLots: [
      { lotId: 12, lotNumber: 'LOT-12', partNumber: 'RESIN-1', consumedQuantity: 0, jobId: null, onHandQuantity: 20, quarantinedQuantity: 20 },
      { lotId: 13, lotNumber: 'LOT-13', partNumber: 'P-100', consumedQuantity: 5, jobId: 8, onHandQuantity: 10, quarantinedQuantity: 10 },
    ],
    affectedShipments: [
      { shipmentId: 1, shipmentNumber: 'SHP-1', customerId: 9, customerName: 'First Buyer', affectedQuantity: 4, shippedDate: new Date('2026-09-20'), trackingNumber: null, isApproximate: false },
      { shipmentId: 2, shipmentNumber: 'SHP-2', customerId: 10, customerName: 'Second Buyer', affectedQuantity: 6, shippedDate: new Date('2026-09-22'), trackingNumber: '1Z', isApproximate: true },
    ],
    ...overrides,
  };
}

interface DialogApi {
  canResolve(): boolean;
  affectedCustomerCount(): number;
  approximateCount(): number;
  resolve(): void;
  close(): void;
}

describe('RecallDetailDialogComponent', () => {
  const dialogRef = { close: vi.fn() };
  let getRecall: ReturnType<typeof vi.fn>;
  let resolveRecall: ReturnType<typeof vi.fn>;
  let roles: string[];

  function create(detail: RecallDetail = recall()) {
    getRecall = vi.fn(() => of(detail));
    resolveRecall = vi.fn(() => of({ ...detail, status: 'Resolved', resolvedAt: new Date('2026-10-05') }));
    TestBed.configureTestingModule({
      imports: [RecallDetailDialogComponent, TranslateModule.forRoot()],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { recallId: detail.id } },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: RecallService, useValue: { getRecall, resolveRecall } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: UserPreferencesService, useValue: { get: () => null, set: vi.fn(), reset: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(RecallDetailDialogComponent);
    fixture.detectChanges();
    return { fixture, api: fixture.componentInstance as unknown as DialogApi };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
    roles = ['Manager'];
  });

  it('loads the recall by id and rolls up its customers', () => {
    const { api } = create();

    expect(getRecall).toHaveBeenCalledWith(4);
    expect(api.affectedCustomerCount()).toBe(2);
  });

  it('flags only the approximate shipment with the Approximate badge', () => {
    const { fixture, api } = create();
    const el = fixture.nativeElement as HTMLElement;

    expect(api.approximateCount()).toBe(1);
    expect(el.querySelectorAll('[data-testid="recall-approximate-badge"]')).toHaveLength(1);
    expect(el.querySelector('[data-testid="recall-approximate-note"]')).not.toBeNull();
  });

  it('shows no badge when every shipment is lot-stamped', () => {
    const exact = recall();
    exact.affectedShipments = exact.affectedShipments.map(s => ({ ...s, isApproximate: false }));
    const { fixture } = create(exact);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[data-testid="recall-approximate-badge"]')).toBeNull();
    expect(el.querySelector('[data-testid="recall-approximate-note"]')).toBeNull();
  });

  it('resolves an active recall and reports the change on close', () => {
    const { api } = create();

    expect(api.canResolve()).toBe(true);
    api.resolve();
    expect(resolveRecall).toHaveBeenCalledWith(4, null);
    expect(api.canResolve()).toBe(false);

    api.close();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('does not offer Resolve to an Engineer', () => {
    roles = ['Engineer'];
    const { fixture, api } = create();

    expect(api.canResolve()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="recall-resolve-btn"]')).toBeNull();
  });
});
