import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { MatDialog } from '@angular/material/dialog';

import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { EmployeeService } from '../../services/employee.service';
import { EmployeeTerminationPanelComponent } from './employee-termination-panel.component';
import { EmployeeTermination } from '../../models/employee-termination.model';

interface PanelInternals {
  loadSummary(id: number, kind: string): void;
  summary(): unknown;
  canMarkProcessed(): boolean;
  markProcessed(): void;
  rehire(): void;
  changed: { emit(): void };
}

function setup(termination: EmployeeTermination) {
  const service = {
    getFinalPaySummary: vi.fn(() => of({ hoursSinceLastPeriod: 7.5, ptoPayoutHours: 12, leaveLines: [] })),
    markFinalPayProcessed: vi.fn(() => of(undefined)),
  };
  const open = vi.fn(() => ({ afterClosed: () => of(true) }));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService(),
      { provide: EmployeeService, useValue: service },
      { provide: ReferenceDataService, useValue: { getByGroup: () => of([{ code: 'layoff', label: 'Layoff' }]) } },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      { provide: MatDialog, useValue: { open } },
    ],
  });
  const panel = TestBed.runInInjectionContext(() => new EmployeeTerminationPanelComponent());
  const view = panel as unknown as PanelInternals;
  const employee = { id: 12, firstName: 'Ann', lastName: 'Lee', termination };
  Object.defineProperty(panel, 'employee', { value: () => employee });
  Object.defineProperty(panel, 'kind', { value: () => 'user' });
  const emitted = vi.spyOn(view.changed, 'emit');
  return { view, service, open, emitted };
}

const applied: EmployeeTermination = {
  terminationDate: '2026-10-07T00:00:00Z', reasonCode: 'layoff', rehireEligible: true,
  finalPayRequired: true, appliedAt: '2026-10-07T14:00:00Z', finalPayProcessedAt: null,
};

describe('EmployeeTerminationPanelComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the final-pay summary for the employee', () => {
    const { view, service } = setup(applied);
    view.loadSummary(12, 'user');
    expect(service.getFinalPaySummary).toHaveBeenCalledWith(12, 'user');
    expect(view.summary()).toEqual(expect.objectContaining({ ptoPayoutHours: 12 }));
  });

  it('offers mark-processed only for an applied termination that still owes final pay', () => {
    expect(setup(applied).view.canMarkProcessed()).toBe(true);
    expect(setup({ ...applied, finalPayProcessedAt: '2026-10-08T00:00:00Z' }).view.canMarkProcessed()).toBe(false);
    expect(setup({ ...applied, appliedAt: null }).view.canMarkProcessed()).toBe(false);
  });

  it('marks final pay processed and tells the page to reload', () => {
    const { view, service, emitted } = setup(applied);
    view.markProcessed();
    expect(service.markFinalPayProcessed).toHaveBeenCalledWith(12, 'user');
    expect(emitted).toHaveBeenCalled();
  });

  it('opens the rehire dialog and reloads after a rehire', () => {
    const { view, open, emitted } = setup(applied);
    view.rehire();
    expect(open).toHaveBeenCalled();
    expect(emitted).toHaveBeenCalled();
  });
});
