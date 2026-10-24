import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { SalesTaxPanelComponent } from './sales-tax-panel.component';
import { AdminService } from '../../services/admin.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DraftResumeService } from '../../../../shared/services/draft-resume.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { SalesTaxRate } from '../../models/sales-tax-rate.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface PanelInternals {
  columns: ColumnDef[];
  rates: { (): SalesTaxRate[] };
  canDelete: boolean;
}

describe('SalesTaxPanelComponent', () => {
  let component: PanelInternals;
  let roles: string[];

  function create(): PanelInternals {
    return TestBed.runInInjectionContext(() => new SalesTaxPanelComponent()) as unknown as PanelInternals;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    roles = ['Admin'];
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        {
          provide: AdminService,
          useValue: { getSalesTaxRates: () => of([{ id: 1, name: 'State', code: 'ST', rate: 0.0625 }, { id: 2, name: 'City', code: 'CT', rate: 0.1 }]) },
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: SnackbarService, useValue: {} },
        { provide: DraftResumeService, useValue: { consume: () => false } },
        { provide: AuthService, useValue: { hasRole: (...wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      ],
    });
    component = create();
  });

  it('sorts the Rate column on the numeric rate, not on a formatted string where "10%" sorts before "6%"', () => {
    const rateColumn = component.columns.find(c => c.field === 'rate');

    expect(rateColumn).toEqual(expect.objectContaining({ sortable: true, type: 'number' }));
    expect(component.columns.some(c => c.field === 'rateDisplay')).toBe(false);
    expect(component.rates().map(r => r.rate)).toEqual([0.0625, 0.1]);
  });

  it('offers Delete only to Admin, matching the Admin-only API', () => {
    expect(component.canDelete).toBe(true);

    roles = ['Manager'];
    expect(create().canDelete).toBe(false);
  });
});
