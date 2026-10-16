import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { CustomerReturnDetailPanelComponent } from './customer-return-detail-panel.component';
import { CustomerReturnService } from '../../services/customer-return.service';
import { CustomerReturnDetail } from '../../models/customer-return-detail.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface PanelInternals {
  detail: { set(value: CustomerReturnDetail | null): void; (): CustomerReturnDetail | null };
  resolve(): void;
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
});
