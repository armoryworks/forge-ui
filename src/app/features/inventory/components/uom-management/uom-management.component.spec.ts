import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';

import { InventoryService } from '../../services/inventory.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { UnitOfMeasure } from '../../models/unit-of-measure.model';
import { UomManagementComponent } from './uom-management.component';

interface UomInternals {
  canManage: boolean;
  uomColumns: ColumnDef[];
  showUomDialog(): boolean;
  openEditUom(uom: UnitOfMeasure): void;
}

function setup(roles: string[]) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService(),
      { provide: InventoryService, useValue: new Proxy({}, { get: () => () => of([]) }) },
      { provide: SnackbarService, useValue: { success: () => undefined } },
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
    ],
  });
  return TestBed.runInInjectionContext(() => new UomManagementComponent()) as unknown as UomInternals;
}

const uom = { id: 1, code: 'EA', name: 'Each', symbol: null, category: 'Count', decimalPlaces: 0, isBaseUnit: true, isActive: true, sortOrder: 0 } as unknown as UnitOfMeasure;

describe('UomManagementComponent permissions', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lets Admin and Manager edit units of measure', () => {
    for (const role of ['Admin', 'Manager']) {
      const uoms = setup([role]);

      expect(uoms.canManage).toBe(true);
      expect(uoms.uomColumns.some(c => c.field === 'actions')).toBe(true);
      uoms.openEditUom(uom);
      expect(uoms.showUomDialog()).toBe(true);
    }
  });

  it('shows units read-only to roles the API refuses', () => {
    for (const role of ['OfficeManager', 'Engineer']) {
      const uoms = setup([role]);

      expect(uoms.canManage).toBe(false);
      expect(uoms.uomColumns.some(c => c.field === 'actions')).toBe(false);
      uoms.openEditUom(uom);
      expect(uoms.showUomDialog()).toBe(false);
    }
  });
});
