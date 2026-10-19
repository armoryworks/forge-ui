import { describe, it, expect, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Signal, WritableSignal } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { GageListComponent } from './gage-list.component';
import { QualityService } from '../services/quality.service';
import { Gage } from '../models/gage.model';
import { AuthService } from '../../../shared/services/auth.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';

interface GageView {
  selectedGage: WritableSignal<Gage | null>;
  searchControl: FormControl<string | null>;
  createForm: FormGroup;
  calForm: FormGroup;
  canManage: Signal<boolean>;
  editingGageId: Signal<number | null>;
  openCreate(): void;
  openEdit(gage: Gage): void;
  saveGage(): void;
  openCalDialog(): void;
  saveCalibration(): void;
}

const GAGE = { id: 6, gageNumber: 'GAG-00006', description: 'Caliper', calibrationIntervalDays: 365, status: 'DueForCalibration' } as Gage;

function create(roles: string[] = ['Manager']) {
  TestBed.resetTestingModule();
  const service = {
    getGages: vi.fn(() => of([GAGE])),
    getGageById: vi.fn(() => of({ ...GAGE, status: 'InService', nextCalibrationDue: '2027-10-19' })),
    getGageCalibrations: vi.fn(() => of([])),
    createCalibrationRecord: vi.fn(() => of({})),
    createGage: vi.fn(() => of(GAGE)),
    updateGage: vi.fn(() => of({ ...GAGE, calibrationIntervalDays: 180 })),
  };
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService(),
      { provide: QualityService, useValue: service },
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      { provide: SnackbarService, useValue: { success: vi.fn() } },
    ],
  });
  const view = TestBed.runInInjectionContext(() => new GageListComponent()) as unknown as GageView;
  return { view, service };
}

describe('GageListComponent', () => {
  afterEach(() => vi.useRealTimers());

  it('shows the gage as calibrated as soon as a calibration is saved', () => {
    const { view, service } = create();
    view.selectedGage.set(GAGE);
    view.openCalDialog();

    view.saveCalibration();

    expect(service.getGageById).toHaveBeenCalledWith(6);
    expect(view.selectedGage()?.status).toBe('InService');
  });

  it('searches as the user types, after a short pause', () => {
    vi.useFakeTimers();
    const { view, service } = create();
    service.getGages.mockClear();

    view.searchControl.setValue('cal');
    expect(service.getGages).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);

    expect(service.getGages).toHaveBeenCalledWith(undefined, 'cal');
  });

  it('caps the calibration interval at ten years', () => {
    const { view } = create();
    view.openCreate();

    view.createForm.patchValue({ description: 'Bore gage', calibrationIntervalDays: 3651 });
    expect(view.createForm.invalid).toBe(true);
    view.createForm.patchValue({ calibrationIntervalDays: 3650 });
    expect(view.createForm.valid).toBe(true);
  });

  it('sends the certificate date for a gage that arrives calibrated', () => {
    const { view, service } = create();
    view.openCreate();
    view.createForm.patchValue({ description: 'Bore gage', lastCalibratedAt: new Date(2026, 9, 1) });

    view.saveGage();

    expect(service.createGage).toHaveBeenCalledWith(expect.objectContaining({ lastCalibratedAt: '2026-10-01T00:00:00Z' }));
  });

  it('edits an existing gage through PATCH, including its status', () => {
    const { view, service } = create();
    view.openEdit(GAGE);
    view.createForm.patchValue({ calibrationIntervalDays: 180, status: 'OutForCalibration' });

    view.saveGage();

    expect(service.updateGage).toHaveBeenCalledWith(6, expect.objectContaining({
      calibrationIntervalDays: 180, status: 'OutForCalibration',
    }));
    expect(service.createGage).not.toHaveBeenCalled();
  });

  it('keeps gage maintenance to Admin and Manager', () => {
    expect(create(['Engineer']).view.canManage()).toBe(false);
    expect(create(['Admin']).view.canManage()).toBe(true);
  });
});
