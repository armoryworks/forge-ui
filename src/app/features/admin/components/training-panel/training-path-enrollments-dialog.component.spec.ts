import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { EmployeeService } from '../../../employees/services/employee.service';
import { TrainingEnrollmentService } from '../../../training/services/training-enrollment.service';
import { TrainingPathEnrollment } from '../../../training/models/training-path-enrollment.model';
import { TrainingPathEnrollmentsDialogComponent } from './training-path-enrollments-dialog.component';

interface EnrollView {
  rows(): TrainingPathEnrollment[];
  userOptions(): { value: unknown }[];
  roleOptions(): { value: unknown }[];
  form: { patchValue(v: unknown): void };
  enroll(): void;
  remove(row: TrainingPathEnrollment): void;
  applyDueDate(row: TrainingPathEnrollment): void;
}

const enrollment = { id: 5, userId: 8, userName: 'Ruiz, Ana', progressPercent: 50 } as TrainingPathEnrollment;

function setup(canEdit: boolean) {
  const service = {
    getPathEnrollments: vi.fn(() => of([enrollment])),
    enroll: vi.fn(() => of({ enrolled: 2, alreadyEnrolled: 1 })),
    setDueDate: vi.fn(() => of(undefined)),
    remove: vi.fn(() => of(undefined)),
  };
  const employees = { getEmployees: vi.fn(() => of([{ id: 8, firstName: 'Ana', lastName: 'Ruiz' }])) };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService(),
      { provide: TrainingEnrollmentService, useValue: service },
      { provide: EmployeeService, useValue: employees },
      { provide: ReferenceDataService, useValue: { getRolesAsOptions: () => of([{ value: 'ProductionWorker', label: 'ProductionWorker' }, { value: 'LeadIntake', label: 'LeadIntake' }]) } },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
      { provide: MAT_DIALOG_DATA, useValue: { pathId: 7, pathTitle: 'Floor safety', canEdit } },
    ],
  });
  const view = TestBed.runInInjectionContext(() => new TrainingPathEnrollmentsDialogComponent()) as unknown as EnrollView;
  return { view, service, employees };
}

describe('TrainingPathEnrollmentsDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lists the path\'s enrolments with their progress', () => {
    const { view, service } = setup(false);
    expect(service.getPathEnrollments).toHaveBeenCalledWith(7);
    expect(view.rows()).toEqual([enrollment]);
  });

  it('loads no pickers for a read-only viewer', () => {
    const { view, employees } = setup(false);
    expect(employees.getEmployees).not.toHaveBeenCalled();
    expect(view.userOptions()).toEqual([]);
  });

  it('enrols people and roles with a due date and reloads', () => {
    const { view, service } = setup(true);
    expect(view.roleOptions().map(o => o.value)).toEqual(['ProductionWorker']);

    view.form.patchValue({ userIds: [8], roles: ['ProductionWorker'], dueDate: new Date(2026, 10, 15) });
    view.enroll();

    expect(service.enroll).toHaveBeenCalledWith(7, { userIds: [8], roles: ['ProductionWorker'], dueDate: '2026-11-15T00:00:00Z' });
    expect(service.getPathEnrollments).toHaveBeenCalledTimes(2);
  });

  it('does nothing when nobody is picked', () => {
    const { view, service } = setup(true);
    view.enroll();
    expect(service.enroll).not.toHaveBeenCalled();
  });

  it('sets the due date on and removes an enrolment', () => {
    const { view, service } = setup(true);
    view.form.patchValue({ dueDate: new Date(2026, 11, 1) });
    view.applyDueDate(enrollment);
    expect(service.setDueDate).toHaveBeenCalledWith(5, '2026-12-01T00:00:00Z');
    view.remove(enrollment);
    expect(service.remove).toHaveBeenCalledWith(5);
  });
});
