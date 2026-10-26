import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { CustomerReturnDetailPanelComponent } from './customer-return-detail-panel.component';
import { CustomerReturnService } from '../../services/customer-return.service';
import { CustomerReturnDetail } from '../../models/customer-return-detail.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { InventoryService } from '../../../inventory/services/inventory.service';

interface PanelInternals {
  detail: { set(value: CustomerReturnDetail | null): void; (): CustomerReturnDetail | null };
  resolve(): void;
  openResolve(): void;
  resolveBlocked(): boolean;
  resolveForm: { patchValue(value: Record<string, unknown>): void };
  closeReturn(r: CustomerReturnDetail): void;
}

describe('CustomerReturnDetailPanelComponent', () => {
  let panel: PanelInternals;
  let service: {
    getById: ReturnType<typeof vi.fn>;
    resolve: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  const received = { id: 7, returnNumber: 'RMA-0007', status: 'Received' } as CustomerReturnDetail;

  beforeEach(() => {
    service = {
      getById: vi.fn(),
      resolve: vi.fn(() => of(null)),
      close: vi.fn(() => of(null)),
    };
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: CustomerReturnService, useValue: service },
        { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of(true) })) } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => code === 'CAP-O2C-RMA' } },
        { provide: InventoryService, useValue: { getAllActiveBinLocations: vi.fn(() => of([{ id: 3, name: 'A1', locationPath: 'Main / A1' }])) } },
      ],
    });
    panel = TestBed.runInInjectionContext(() => new CustomerReturnDetailPanelComponent()) as unknown as PanelInternals;
    panel.detail.set(received);
  });

  it('reloads the return after Resolve instead of showing the empty 204 body', () => {
    service.getById.mockReturnValue(of({ ...received, status: 'Resolved' }));

    panel.resolve();

    expect(service.getById).toHaveBeenCalledWith(7);
    expect(panel.detail()?.status).toBe('Resolved');
  });

  it('reloads the return after Close instead of showing the empty 204 body', () => {
    service.getById.mockReturnValue(of({ ...received, status: 'Closed' }));

    panel.closeReturn(received);

    expect(service.getById).toHaveBeenCalledWith(7);
    expect(panel.detail()?.status).toBe('Closed');
  });

  it('sends the disposition, location and credit choice when resolving to stock', () => {
    service.getById.mockReturnValue(of({ ...received, status: 'Resolved' }));
    panel.detail.set({ ...received, quantity: 10 });
    panel.openResolve();
    panel.resolveForm.patchValue({ disposition: 'ReturnToStock', quantity: 10 });
    expect(panel.resolveBlocked()).toBe(true);
    panel.resolveForm.patchValue({ restockLocationId: 3, restockingFeePercent: 10 });
    expect(panel.resolveBlocked()).toBe(false);

    panel.resolve();

    expect(service.resolve).toHaveBeenCalledWith(7, undefined, expect.objectContaining({
      disposition: 'ReturnToStock', quantity: 10, restockLocationId: 3, issueCredit: true, restockingFeePercent: 10,
    }));
  });

  it('never asks for a credit memo on a channel return', () => {
    service.getById.mockReturnValue(of({ ...received, status: 'Resolved' }));
    panel.detail.set({ ...received, quantity: 2, channelId: 5 });
    panel.openResolve();
    panel.resolveForm.patchValue({ disposition: 'NoReturn', quantity: 2 });

    panel.resolve();

    expect(service.resolve).toHaveBeenCalledWith(7, undefined, expect.objectContaining({ disposition: 'NoReturn', issueCredit: false }));
  });
});
