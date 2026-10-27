import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';

import { of } from 'rxjs';

import { SnackbarService } from '../../../shared/services/snackbar.service';
import { AdminService } from '../services/admin.service';
import { PlantService } from '../services/plant.service';
import { Plant } from '../models/plant.model';
import { PlantsAdminComponent } from './plants-admin.component';

interface PageInternals {
  plants(): Plant[];
  loading(): boolean;
  openNew(): void;
  openEdit(plant: Plant): void;
}

const plant: Plant = {
  id: 4, code: 'P1', name: 'Main', companyLocationId: 1, locationName: 'HQ', timeZone: 'America/Denver', currencyCode: 'USD',
  isActive: true, isDefault: true, createdAt: '', updatedAt: '',
};

describe('PlantsAdminComponent', () => {
  const service = { list: vi.fn(), create: vi.fn(), update: vi.fn() };
  const dialog = { open: vi.fn() };
  const snackbar = { success: vi.fn(), errorFrom: vi.fn() };

  function build(): PageInternals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: PlantService, useValue: service },
        { provide: AdminService, useValue: { getCompanyLocations: () => of([]) } },
        { provide: MatDialog, useValue: dialog },
        { provide: SnackbarService, useValue: snackbar },
      ],
    });
    return TestBed.runInInjectionContext(() => new PlantsAdminComponent()) as unknown as PageInternals;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    service.list.mockReturnValue(of([plant]));
    service.create.mockReturnValue(of(plant));
    service.update.mockReturnValue(of(undefined));
  });

  it('lists the plants', () => {
    const page = build();

    expect(page.plants()).toEqual([plant]);
    expect(page.loading()).toBe(false);
  });

  it('creates a plant from the dialog and reloads', () => {
    const request = { code: 'P2', name: 'North', companyLocationId: 1, timeZone: null, currencyCode: null, isActive: true, isDefault: false };
    dialog.open.mockReturnValue({ afterClosed: () => of(request) });
    const page = build();

    page.openNew();

    expect(service.create).toHaveBeenCalledWith(request);
    expect(service.list).toHaveBeenCalledTimes(2);
    expect(snackbar.success).toHaveBeenCalled();
  });

  it('updates the plant that was clicked and does nothing when the dialog is cancelled', () => {
    dialog.open.mockReturnValueOnce({ afterClosed: () => of(undefined) });
    const page = build();

    page.openEdit(plant);
    expect(service.update).not.toHaveBeenCalled();

    dialog.open.mockReturnValueOnce({ afterClosed: () => of({ ...plant, name: 'Renamed' }) });
    page.openEdit(plant);
    expect(service.update).toHaveBeenCalledWith(4, expect.objectContaining({ name: 'Renamed' }));
  });
});
