import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { environment } from '../../../../../environments/environment';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { EmployeeDetail } from '../../models/employee.model';
import { EmployeeTerminateDialogComponent } from './employee-terminate-dialog.component';

interface DialogView {
  form: { invalid: boolean; patchValue(v: unknown): void };
  reasonOptions(): { value: unknown; label: string }[];
  scheduled(): boolean;
  checklist(): string[];
  save(): void;
}

function setup(employee: Partial<EmployeeDetail> = {}) {
  const close = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideTranslateService(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: { employee: { id: 12, firstName: 'Ann', lastName: 'Lee', hasLogin: true, ...employee }, kind: 'user' } },
      { provide: ReferenceDataService, useValue: { getAsOptions: vi.fn(() => of([{ value: 'layoff', label: 'Layoff' }])) } },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
    ],
  });
  const view = TestBed.runInInjectionContext(() => new EmployeeTerminateDialogComponent()) as unknown as DialogView;
  return { view, close, http: TestBed.inject(HttpTestingController) };
}

describe('EmployeeTerminateDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the termination reasons and needs one before it can save', () => {
    const { view } = setup();
    expect(view.reasonOptions()).toEqual([{ value: 'layoff', label: 'Layoff' }]);
    expect(view.form.invalid).toBe(true);
    view.form.patchValue({ reasonCode: 'layoff' });
    expect(view.form.invalid).toBe(false);
  });

  it('lists what termination does for a user with a login, and only the profile for one without', () => {
    expect(setup().view.checklist()).toContain('employees.termination.checklist.credentials');
    expect(setup({ hasLogin: false }).view.checklist()).toEqual([
      'employees.termination.checklist.profileOnly',
      'employees.termination.checklist.audit',
    ]);
  });

  it('marks a future date as scheduled', () => {
    const { view } = setup();
    expect(view.scheduled()).toBe(false);
    const later = new Date();
    later.setDate(later.getDate() + 5);
    view.form.patchValue({ terminationDate: later });
    expect(view.scheduled()).toBe(true);
  });

  it('posts the termination for the employee and closes with the result', () => {
    const { view, close, http } = setup();
    view.form.patchValue({ terminationDate: new Date(2026, 9, 30), reasonCode: 'layoff', notes: '  Plant closure  ', rehireEligible: true, finalPayRequired: true });

    view.save();

    const req = http.expectOne(r => r.url === `${environment.apiUrl}/employees/12/terminate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.params.get('kind')).toBe('user');
    expect(req.request.body).toEqual({
      terminationDate: '2026-10-30T00:00:00Z',
      reasonCode: 'layoff',
      notes: 'Plant closure',
      rehireEligible: true,
      finalPayRequired: true,
    });
    req.flush({ employeeProfileId: 4, terminationDate: '2026-10-30', reasonCode: 'layoff', appliedAt: null });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ employeeProfileId: 4 }));
  });
});
