import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { LeavePoliciesComponent } from './leave-policies.component';
import { LeaveService } from '../../services/leave.service';
import { LeavePolicy } from '../../models/leave-policy.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface PoliciesInternals {
  form: FormGroup;
  openCreate(): void;
  openEdit(policy: LeavePolicy): void;
  save(): void;
}

const PTO: LeavePolicy = {
  id: 2, name: 'PTO', accrualRatePerPayPeriod: 3.08, maxBalance: 120, carryOverLimit: 40,
  accrueFromHireDate: true, waitingPeriodDays: 90, isPaidLeave: true, isActive: true,
};

function setup() {
  const service = {
    getPolicies: vi.fn().mockReturnValue(of([PTO])),
    createPolicy: vi.fn().mockReturnValue(of(PTO)),
    updatePolicy: vi.fn().mockReturnValue(of(PTO)),
  };
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: LeaveService, useValue: service },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new LeavePoliciesComponent()) as unknown as PoliciesInternals;
  return { component, service };
}

describe('LeavePoliciesComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lists inactive policies too', () => {
    const { service } = setup();
    expect(service.getPolicies).toHaveBeenCalledWith(false);
  });

  it('edits accrual rate, cap, carryover and waiting period with PUT', () => {
    const { component, service } = setup();
    component.openEdit(PTO);
    component.form.patchValue({ accrualRatePerPayPeriod: 4, maxBalance: '', waitingPeriodDays: 30 });

    component.save();

    expect(service.updatePolicy).toHaveBeenCalledWith(2, {
      name: 'PTO', accrualRatePerPayPeriod: 4, maxBalance: null, carryOverLimit: 40, waitingPeriodDays: 30,
      accrueFromHireDate: true, isPaidLeave: true, isActive: true,
    });
  });

  it('creates a new policy', () => {
    const { component, service } = setup();
    component.openCreate();
    component.form.patchValue({ name: ' Sick ', accrualRatePerPayPeriod: 1.5 });

    component.save();

    expect(service.createPolicy).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sick', accrualRatePerPayPeriod: 1.5 }));
  });
});
