import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';

import { CompanyLocation } from '../models/company-location.model';
import { Plant } from '../models/plant.model';
import { PlantDialogComponent, PlantDialogData } from './plant-dialog.component';

interface DialogInternals {
  form: { controls: Record<string, { value: unknown; setValue(v: unknown): void }>; invalid: boolean };
  locationOptions: { value: unknown; label: string }[];
  save(): void;
}

const location = (id: number, extra: Partial<CompanyLocation> = {}): CompanyLocation => ({
  id, name: `Site ${id}`, line1: `${id} Main St`, line2: null, city: 'Ogden', state: 'UT', postalCode: '84401', country: 'US',
  phone: null, isDefault: false, isActive: true, createdAt: new Date(), updatedAt: new Date(), ...extra,
});

describe('PlantDialogComponent', () => {
  const close = vi.fn();

  function build(data: PlantDialogData): DialogInternals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });
    return TestBed.runInInjectionContext(() => new PlantDialogComponent()) as unknown as DialogInternals;
  }

  beforeEach(() => close.mockReset());

  it('defaults a new plant to the default active location and saves a trimmed request', () => {
    const dialog = build({ locations: [location(1), location(2, { isDefault: true }), location(3, { isActive: false })] });

    expect(dialog.form.controls['companyLocationId'].value).toBe(2);
    expect(dialog.locationOptions.map(o => o.value)).toEqual([1, 2]);
    expect(dialog.locationOptions[0].label).toContain('1 Main St');

    dialog.form.controls['code'].setValue(' P2 ');
    dialog.form.controls['name'].setValue(' North plant ');
    dialog.form.controls['timeZone'].setValue('America/Denver');
    dialog.form.controls['currencyCode'].setValue('usd');
    dialog.form.controls['isDefault'].setValue(true);
    dialog.save();

    expect(close).toHaveBeenCalledWith({
      code: 'P2', name: 'North plant', companyLocationId: 2, timeZone: 'America/Denver',
      currencyCode: 'USD', isActive: true, isDefault: true,
    });
  });

  it('refuses a currency that is not a three-letter code and saves a blank one as none', () => {
    const plant: Plant = {
      id: 9, code: 'P1', name: 'Main', companyLocationId: 3, locationName: 'Site 3', timeZone: null, currencyCode: null,
      isActive: true, isDefault: true, createdAt: '', updatedAt: '',
    };
    const dialog = build({ plant, locations: [location(1), location(3, { isActive: false })] });

    expect(dialog.locationOptions.map(o => o.value)).toEqual([1, 3]);
    dialog.form.controls['currencyCode'].setValue('US');
    expect(dialog.form.invalid).toBe(true);
    dialog.save();
    expect(close).not.toHaveBeenCalled();

    dialog.form.controls['currencyCode'].setValue('');
    dialog.save();
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ code: 'P1', currencyCode: null, timeZone: null, companyLocationId: 3 }));
  });
});
