import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { VendorStatementPanelComponent } from './vendor-statement-panel.component';
import { VendorCreditMemoService } from '../../services/vendor-credit-memo.service';
import { VendorStatement } from '../../models/vendor-statement.model';

interface PanelInternals {
  vendorControl: { setValue(v: number | null): void };
  statement(): VendorStatement | null;
}

describe('VendorStatementPanelComponent', () => {
  it('loads the statement of the picked vendor and clears it when none is picked', () => {
    const statement = {
      vendorId: 2, vendorName: 'Steel Supply', asOf: '', totals: [{ currencyId: 1, currencyCode: 'USD', openBalance: 400 }],
      lines: [{ documentType: 'VendorCreditMemo', openAmount: -100 }],
    } as unknown as VendorStatement;
    const getStatement = vi.fn(() => of(statement));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideTranslateService(), { provide: VendorCreditMemoService, useValue: { getStatement } }],
    });
    const panel = TestBed.runInInjectionContext(() => new VendorStatementPanelComponent()) as unknown as PanelInternals;

    panel.vendorControl.setValue(2);
    expect(getStatement).toHaveBeenCalledWith(2);
    expect(panel.statement()?.totals[0].openBalance).toBe(400);

    panel.vendorControl.setValue(null);
    expect(panel.statement()).toBeNull();
  });
});
