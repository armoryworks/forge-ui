import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { vi } from 'vitest';

import { PhysicalInventoryTagDialogComponent } from './physical-inventory-tag-dialog.component';
import { PhysicalInventoryService } from '../../services/physical-inventory.service';
import { InventoryService } from '../../../services/inventory.service';

interface DialogInternals {
  form: { patchValue(v: Record<string, unknown>): void; invalid: boolean };
  added: { subscribe(fn: (tag: unknown) => void): void };
  submit(): void;
}

describe('PhysicalInventoryTagDialogComponent', () => {
  it('adds a found item as a counted tag', () => {
    const addTag = vi.fn().mockReturnValue(of({ id: 30, tagNumber: 30 }));
    TestBed.configureTestingModule({
      providers: [
        { provide: PhysicalInventoryService, useValue: { addTag } },
        { provide: InventoryService, useValue: { getAllActiveBinLocations: () => of([{ id: 2, name: 'Rack 1', locationPath: 'Warehouse / Rack 1' }]) } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const dialog = TestBed.runInInjectionContext(() => new PhysicalInventoryTagDialogComponent()) as unknown as DialogInternals;
    Object.assign(dialog, { inventoryId: () => 7 });
    const emitted = vi.fn();
    dialog.added.subscribe(emitted);
    expect(dialog.form.invalid).toBe(true);
    dialog.form.patchValue({ locationId: 2, partId: 5, lotNumber: ' L9 ', quantity: 4 });

    dialog.submit();

    expect(addTag).toHaveBeenCalledWith(7, { locationId: 2, partId: 5, lotNumber: 'L9', serialNumber: null, quantity: 4, notes: null });
    expect(emitted).toHaveBeenCalledWith({ id: 30, tagNumber: 30 });
  });
});
