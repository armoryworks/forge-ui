import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { PurchaseOrderService } from '../../services/purchase-order.service';
import { PurchaseOrderDetail } from '../../models/purchase-order-detail.model';
import { PurchaseOrderLine } from '../../models/purchase-order-line.model';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { CurrencyService } from '../../../../shared/services/currency.service';
import { VendorService } from '../../../vendors/services/vendor.service';
import { SendPoEmailDialogComponent } from '../send-po-email-dialog/send-po-email-dialog.component';
import { PoDetailPanelComponent } from './po-detail-panel.component';

interface PanelInternals {
  purchaseOrderId: () => number;
  po: ReturnType<typeof signal<PurchaseOrderDetail | null>>;
  canReceive(status: string): boolean;
  canEditLines(status: string): boolean;
  canCancel(status: string): boolean;
  incotermLabel(): string;
  showFxRate(): boolean;
  originLabel(): string;
  originTooltip(): string;
  addLineForm: FormGroup;
  addLineMissingDescription: boolean;
  saveAddLine(): void;
  deleteLine(line: PurchaseOrderLine): void;
  openEmailDialog(): void;
}

function detail(overrides: Partial<PurchaseOrderDetail> = {}): PurchaseOrderDetail {
  return {
    id: 7,
    poNumber: 'PO-7',
    vendorId: 3,
    vendorName: 'Bar Stock Co',
    status: 'Draft',
    incoterm: 'FOB_Origin',
    quoteCurrency: 'USD',
    fxRate: 1,
    fxRateSource: 'auto: same-currency (USD)',
    originSource: 'Manual',
    originUserName: 'Admin, User',
    originReference: null,
    lines: [],
    ...overrides,
  } as PurchaseOrderDetail;
}

function line(overrides: Partial<PurchaseOrderLine> = {}): PurchaseOrderLine {
  return { id: 11, partId: 5, partNumber: 'BAR-1', description: 'Bar stock', ...overrides } as PurchaseOrderLine;
}

describe('PoDetailPanelComponent', () => {
  const poService = {
    getPurchaseOrderById: vi.fn(),
    getReleases: vi.fn(() => of([])),
    getFiles: vi.fn(() => of([])),
    addPurchaseOrderLine: vi.fn(() => of(undefined)),
    deletePurchaseOrderLine: vi.fn(() => of(undefined)),
  };
  const dialog = { open: vi.fn() };
  const vendorService = { getVendorById: vi.fn() };
  const baseCurrency = signal('USD');

  function create(po: PurchaseOrderDetail): PanelInternals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PurchaseOrderService, useValue: poService },
        { provide: ReferenceDataService, useValue: { getAsOptions: () => of([]) } },
        { provide: MatDialog, useValue: dialog },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: AuthService, useValue: { hasAnyRole: () => true, hasRole: () => true } },
        { provide: ManualNumberSettingsService, useValue: { isEnabled: () => false } },
        { provide: CurrencyService, useValue: { baseCurrency } },
        { provide: VendorService, useValue: vendorService },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new PoDetailPanelComponent());
    const internals = component as unknown as PanelInternals;
    internals.purchaseOrderId = () => po.id;
    internals.po.set(po);
    poService.getPurchaseOrderById.mockReturnValue(of(po));
    return internals;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    baseCurrency.set('USD');
  });

  describe('receive availability', () => {
    it.each(['Submitted', 'Acknowledged', 'PartiallyReceived'])('offers Receive Items on a %s PO', (status) => {
      expect(create(detail()).canReceive(status)).toBe(true);
    });

    it.each(['Draft', 'Received', 'Closed', 'Cancelled'])('hides Receive Items on a %s PO', (status) => {
      expect(create(detail()).canReceive(status)).toBe(false);
    });
  });

  describe('readable labels', () => {
    it('shows the incoterm with the create form label', () => {
      expect(create(detail({ incoterm: 'FOB_Origin' })).incotermLabel()).toBe('FOB Origin — buyer takes title at shipping point');
    });

    it('falls back to the stored incoterm when it is unknown', () => {
      expect(create(detail({ incoterm: 'XYZ' })).incotermLabel()).toBe('XYZ');
    });

    it('hides the FX rate when the PO is in the base currency', () => {
      expect(create(detail({ quoteCurrency: 'USD', fxRate: 1 })).showFxRate()).toBe(false);
    });

    it('shows the FX rate for a foreign-currency PO', () => {
      expect(create(detail({ quoteCurrency: 'EUR', fxRate: 1.08 })).showFxRate()).toBe(true);
    });

    it('labels a manual PO Manual and names the creator in the tooltip', () => {
      const panel = create(detail());
      expect(panel.originLabel()).toBe('purchaseOrders.originManual');
      expect(panel.originTooltip()).toBe('purchaseOrders.originTooltipUser');
    });

    it('offers Cancel PO only before any receipt', () => {
      const panel = create(detail());
      expect(panel.canCancel('Submitted')).toBe(true);
      expect(panel.canCancel('PartiallyReceived')).toBe(false);
    });
  });

  describe('draft line editing', () => {
    it('allows line edits only on a draft PO', () => {
      const panel = create(detail());
      expect(panel.canEditLines('Draft')).toBe(true);
      expect(panel.canEditLines('Submitted')).toBe(false);
    });

    it('adds a line through the service and reloads the PO', () => {
      const panel = create(detail());
      panel.addLineForm.setValue({ partId: 5, description: ' Bar stock ', quantity: 4, unitPrice: 12.5 });

      panel.saveAddLine();

      expect(poService.addPurchaseOrderLine).toHaveBeenCalledWith(7, {
        partId: 5, description: 'Bar stock', quantity: 4, unitPrice: 12.5,
      });
      expect(poService.getPurchaseOrderById).toHaveBeenCalledWith(7);
    });

    it('requires a description when the line has no part', () => {
      const panel = create(detail());
      panel.addLineForm.setValue({ partId: null, description: '  ', quantity: 1, unitPrice: 0 });

      expect(panel.addLineMissingDescription).toBe(true);
      panel.saveAddLine();
      expect(poService.addPurchaseOrderLine).not.toHaveBeenCalled();
    });

    it('removes a line after confirmation', () => {
      dialog.open.mockReturnValue({ afterClosed: () => of(true) });
      const panel = create(detail());

      panel.deleteLine(line({ id: 11 }));

      expect(poService.deletePurchaseOrderLine).toHaveBeenCalledWith(7, 11);
    });

    it('keeps the line when the confirmation is dismissed', () => {
      dialog.open.mockReturnValue({ afterClosed: () => of(false) });
      const panel = create(detail());

      panel.deleteLine(line({ id: 11 }));

      expect(poService.deletePurchaseOrderLine).not.toHaveBeenCalled();
    });
  });

  describe('email PO', () => {
    it('prefills the chosen vendor contact email', () => {
      dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      const panel = create(detail({ vendorContactEmail: 'contact@vendor.test' }));

      panel.openEmailDialog();

      expect(vendorService.getVendorById).not.toHaveBeenCalled();
      expect(dialog.open).toHaveBeenCalledWith(SendPoEmailDialogComponent, expect.objectContaining({
        data: expect.objectContaining({ purchaseOrderId: 7, recipientEmail: 'contact@vendor.test' }),
      }));
    });

    it('falls back to the vendor email when no contact is chosen', () => {
      dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      vendorService.getVendorById.mockReturnValue(of({ id: 3, email: 'orders@vendor.test' }));
      const panel = create(detail());

      panel.openEmailDialog();

      expect(vendorService.getVendorById).toHaveBeenCalledWith(3);
      expect(dialog.open).toHaveBeenCalledWith(SendPoEmailDialogComponent, expect.objectContaining({
        data: expect.objectContaining({ recipientEmail: 'orders@vendor.test' }),
      }));
    });
  });
});
