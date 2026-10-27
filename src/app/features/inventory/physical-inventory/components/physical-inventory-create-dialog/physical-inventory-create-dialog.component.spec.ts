import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { vi } from 'vitest';

import { PhysicalInventoryCreateDialogComponent } from './physical-inventory-create-dialog.component';
import { PhysicalInventoryService } from '../../services/physical-inventory.service';
import { InventoryService } from '../../../services/inventory.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';

interface DialogInternals {
  form: { patchValue(v: Record<string, unknown>): void; invalid: boolean };
  scopeOptions(): { value: unknown; label: string }[];
  created: { subscribe(fn: (id: number) => void): void };
  submit(): void;
}

describe('PhysicalInventoryCreateDialogComponent', () => {
  const create = vi.fn();

  function build(): DialogInternals {
    TestBed.configureTestingModule({
      providers: [
        { provide: PhysicalInventoryService, useValue: { create } },
        { provide: InventoryService, useValue: { getLocationTree: () => of([{ id: 1, name: 'Warehouse', children: [{ id: 2, name: 'Rack 1', children: [] }] }]) } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    return TestBed.runInInjectionContext(() => new PhysicalInventoryCreateDialogComponent()) as unknown as DialogInternals;
  }

  it('offers the whole site and every location as the scope', () => {
    const dialog = build();
    expect(dialog.scopeOptions().map(o => o.label)).toEqual(['physicalInventory.wholeSite', 'Warehouse', 'Warehouse / Rack 1']);
  });

  it('creates the draft with a date-only count date and emits its id', () => {
    create.mockReturnValue(of({ id: 12, inventoryNumber: 'PI-000012' }));
    const dialog = build();
    const emitted = vi.fn();
    dialog.created.subscribe(emitted);
    dialog.form.patchValue({ description: ' Year end ', scopeLocationId: 2, countDate: new Date(2026, 5, 30), recountTolerancePercent: 5 });

    dialog.submit();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      description: 'Year end', scopeLocationId: 2, countDate: '2026-06-30', blindCount: true, recountTolerancePercent: 5,
    }));
    expect(emitted).toHaveBeenCalledWith(12);
  });

  it('refuses a tolerance over 100 percent', () => {
    const dialog = build();
    dialog.form.patchValue({ recountTolerancePercent: 150 });
    expect(dialog.form.invalid).toBe(true);
  });
});
