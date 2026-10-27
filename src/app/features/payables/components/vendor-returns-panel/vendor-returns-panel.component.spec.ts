import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { VendorReturnsPanelComponent } from './vendor-returns-panel.component';
import { VendorReturnService } from '../../services/vendor-return.service';
import { VendorReturnListItem } from '../../models/vendor-return-list-item.model';
import { DetailDialogService } from '../../../../shared/services/detail-dialog.service';

interface PanelInternals {
  returns(): VendorReturnListItem[];
  filters: { patchValue(v: Record<string, unknown>): void };
  openDetail(id: number): void;
}

describe('VendorReturnsPanelComponent', () => {
  it('lists returns, filters by status and opens one', () => {
    const getReturns = vi.fn(() => of([{ id: 3, returnNumber: 'RTV-000003' }]));
    const open = vi.fn(() => ({ afterClosed: () => of(false) }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: VendorReturnService, useValue: { getReturns } },
        { provide: DetailDialogService, useValue: { getDetailFromUrl: () => null, open } },
      ],
    });
    const panel = TestBed.runInInjectionContext(() => new VendorReturnsPanelComponent()) as unknown as PanelInternals;

    expect(panel.returns().length).toBe(1);
    panel.filters.patchValue({ status: 'Open' });
    expect(getReturns).toHaveBeenLastCalledWith(null, 'Open');

    panel.openDetail(3);
    expect(open).toHaveBeenCalledWith('vendor-return', 3, expect.anything(), { returnId: 3 }, { width: '760px' });
  });
});
