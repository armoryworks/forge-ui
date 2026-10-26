import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ShipmentService } from '../../services/shipment.service';
import { ShipmentPackage } from '../../models/shipment-package.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ShipmentPackagesSectionComponent } from './shipment-packages-section.component';

const pkg = (id: number, weight: number | null): ShipmentPackage => ({
  id, shipmentId: 7, trackingNumber: null, carrier: null, weight, length: 10, width: 8, height: 6, status: 'Pending',
});

interface Internals {
  packages: Signal<ShipmentPackage[]>;
  totalWeight: Signal<number>;
  form: FormGroup;
  showForm: Signal<boolean>;
  openAdd(): void;
  openEdit(p: ShipmentPackage): void;
  save(): void;
  remove(p: ShipmentPackage): void;
}

describe('ShipmentPackagesSectionComponent', () => {
  const getPackages = vi.fn();
  const addPackage = vi.fn(() => of(pkg(3, 4)));
  const updatePackage = vi.fn(() => of(pkg(1, 9)));
  const removePackage = vi.fn(() => of(undefined));
  const open = vi.fn(() => ({ afterClosed: () => of(true) }));

  function create(): { c: Internals; changed: ReturnType<typeof vi.fn> } {
    const component = TestBed.runInInjectionContext(() => new ShipmentPackagesSectionComponent());
    mockSignalInputs(component, { shipmentId: 7, editable: true });
    const changed = vi.fn();
    component.changed.subscribe(changed);
    TestBed.tick();
    return { c: component as unknown as Internals, changed };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    getPackages.mockReset().mockReturnValue(of([pkg(1, 12.5), pkg(2, 3)]));
    [addPackage, updatePackage, removePackage, open].forEach(f => f.mockClear());
    TestBed.configureTestingModule({
      providers: [
        { provide: ShipmentService, useValue: { getPackages, addPackage, updatePackage, removePackage } },
        { provide: MatDialog, useValue: { open } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
  });

  it('loads the packages and totals their weight for the rates', () => {
    const { c } = create();
    expect(getPackages).toHaveBeenCalledWith(7);
    expect(c.packages().length).toBe(2);
    expect(c.totalWeight()).toBe(15.5);
  });

  it('adds a package with its weight, dimensions and tracking', () => {
    const { c, changed } = create();
    c.openAdd();
    c.form.patchValue({ weight: 4, length: 12, width: 10, height: 8, trackingNumber: ' 1Z99 ' });

    c.save();

    expect(addPackage).toHaveBeenCalledWith(7, { weight: 4, length: 12, width: 10, height: 8, trackingNumber: '1Z99' });
    expect(changed).toHaveBeenCalled();
    expect(c.showForm()).toBe(false);
  });

  it('edits an existing package through the update call', () => {
    const { c } = create();
    c.openEdit(pkg(1, 12.5));
    c.form.patchValue({ weight: 9 });

    c.save();

    expect(updatePackage).toHaveBeenCalledWith(7, 1, expect.objectContaining({ weight: 9, length: 10 }));
    expect(addPackage).not.toHaveBeenCalled();
  });

  it('refuses a package without a weight', () => {
    const { c } = create();
    c.openAdd();

    c.save();

    expect(addPackage).not.toHaveBeenCalled();
  });

  it('removes a package once confirmed', () => {
    const { c, changed } = create();
    c.remove(pkg(2, 3));
    expect(removePackage).toHaveBeenCalledWith(7, 2);
    expect(changed).toHaveBeenCalled();
  });
});
