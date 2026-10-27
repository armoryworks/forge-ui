import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { EmployeeService } from '../../../employees/services/employee.service';
import { ReviewsService } from '../../services/reviews.service';
import { ReviewCycle } from '../../models/review-cycle.model';
import { ReviewCycleDialogComponent } from './review-cycle-dialog.component';

interface DialogView {
  form: { invalid: boolean; patchValue(v: unknown): void; controls: { scopeType: { disabled: boolean } } };
  employeeOptions(): { value: unknown }[];
  showEmployees(): boolean;
  save(): void;
}

function setup(cycle: ReviewCycle | null) {
  const service = {
    createCycle: vi.fn(() => of({ id: 5, name: 'H1' })),
    updateCycle: vi.fn(() => of({ id: 5, name: 'H1' })),
  };
  const close = vi.fn();
  const snackbar = { success: vi.fn(), error: vi.fn(), errorFrom: vi.fn() };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService(),
      { provide: ReviewsService, useValue: service },
      { provide: EmployeeService, useValue: { getEmployees: () => of([{ id: 8, firstName: 'Ana', lastName: 'Ruiz' }, { id: 9, firstName: 'No', lastName: 'Login', hasLogin: false }]) } },
      { provide: SnackbarService, useValue: snackbar },
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: cycle },
    ],
  });
  const view = TestBed.runInInjectionContext(() => new ReviewCycleDialogComponent()) as unknown as DialogView;
  return { view, service, close, snackbar };
}

describe('ReviewCycleDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('offers only employees with a login for a list scope', () => {
    const { view } = setup(null);
    expect(view.employeeOptions().map(o => o.value)).toEqual([8]);
  });

  it('refuses an end date before the start date', () => {
    const { view } = setup(null);
    view.form.patchValue({ name: 'H1', startDate: new Date(2026, 5, 30), endDate: new Date(2026, 0, 1) });
    expect(view.form.invalid).toBe(true);
  });

  it('creates a cycle with one competency per line', () => {
    const { view, service, close } = setup(null);
    view.form.patchValue({
      name: ' H1 ', startDate: new Date(2026, 0, 1), endDate: new Date(2026, 5, 30),
      ratingScaleMax: 4, competencies: 'Quality\n\n Safety ', scopeType: 'list', scopeUserIds: [8],
    });
    expect(view.showEmployees()).toBe(true);

    view.save();

    expect(service.createCycle).toHaveBeenCalledWith({
      name: 'H1', startDate: '2026-01-01T00:00:00Z', endDate: '2026-06-30T00:00:00Z', description: null,
      ratingScaleMax: 4, competencies: ['Quality', 'Safety'], scopeType: 'list', scopeDepartment: null, scopeUserIds: [8],
    });
    expect(close).toHaveBeenCalledWith({ id: 5, name: 'H1' });
  });

  it('needs at least one employee for a list scope', () => {
    const { view, service, snackbar } = setup(null);
    view.form.patchValue({ name: 'H1', startDate: new Date(2026, 0, 1), endDate: new Date(2026, 5, 30), scopeType: 'list', scopeUserIds: [] });
    view.save();
    expect(service.createCycle).not.toHaveBeenCalled();
    expect(snackbar.error).toHaveBeenCalled();
  });

  it('locks the scope of a launched cycle and saves through update', () => {
    const { view, service } = setup({
      id: 5, name: 'H1', startDate: '2026-01-01T00:00:00Z', endDate: '2026-06-30T00:00:00Z', status: 'Active',
      description: null, reviewCount: 3, ratingScaleMax: 5, competencies: ['Quality'], scopeType: 'all',
      scopeDepartment: null, scopeUserIds: null, launchedAt: null, closedAt: null, progress: null,
    });
    expect(view.form.controls.scopeType.disabled).toBe(true);
    view.save();
    expect(service.updateCycle).toHaveBeenCalledWith(5, expect.objectContaining({ competencies: ['Quality'], scopeType: 'all' }));
  });
});
