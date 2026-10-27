import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { LeaveBalancesComponent } from './leave-balances.component';
import { LeaveService } from '../../services/leave.service';
import { LeaveBalance } from '../../models/leave-balance.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface BalancesInternals {
  form: FormGroup;
  ruleViolations: () => string[];
  history: () => unknown[];
  openAdjust(row?: LeaveBalance): void;
  saveAdjustment(): void;
  openHistory(row: LeaveBalance): void;
}

const ROW: LeaveBalance = {
  id: 5, userId: 7, policyId: 2, policyName: 'PTO', balance: 24, usedThisYear: 8, accruedThisYear: 32,
  lastAccrualDate: '2026-10-18T00:00:00Z', userName: 'Kelly, Ben',
};

function setup() {
  const service = {
    getAllBalances: vi.fn().mockReturnValue(of([ROW])),
    getPolicies: vi.fn().mockReturnValue(of([{ id: 2, name: 'PTO' }])),
    getUsers: vi.fn().mockReturnValue(of([{ id: 7, name: 'Kelly, Ben' }, { id: 8, name: 'Ortiz, Rosa' }])),
    adjustBalance: vi.fn().mockReturnValue(of({ balanceAfter: 40, policyName: 'PTO' })),
    getAdjustments: vi.fn().mockReturnValue(of([{ id: 1 }])),
  };
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: LeaveService, useValue: service },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new LeaveBalancesComponent()) as unknown as BalancesInternals;
  return { component, service };
}

describe('LeaveBalancesComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads every employee\'s balance', () => {
    const { service } = setup();
    expect(service.getAllBalances).toHaveBeenCalled();
  });

  it('records an opening balance for a new employee on day one', () => {
    const { component, service } = setup();
    component.openAdjust();
    component.form.patchValue({ userId: 8, policyId: 2, hours: 40, effectiveDate: new Date(2026, 9, 26) });

    component.saveAdjustment();

    expect(service.adjustBalance).toHaveBeenCalledWith(8, {
      policyId: 2, type: 'Opening', hours: 40, effectiveDate: '2026-10-26', reason: null,
    });
  });

  it('asks for a reason before saving an adjustment', () => {
    const { component, service } = setup();
    component.openAdjust(ROW);
    component.form.patchValue({ hours: -4 });

    expect(component.form.get('type')!.value).toBe('Adjustment');
    expect(component.ruleViolations().length).toBe(1);
    component.saveAdjustment();
    expect(service.adjustBalance).not.toHaveBeenCalled();

    component.form.patchValue({ reason: 'Payroll correction' });
    component.saveAdjustment();
    expect(service.adjustBalance).toHaveBeenCalledWith(7, expect.objectContaining({ type: 'Adjustment', hours: -4, reason: 'Payroll correction' }));
  });

  it('loads the ledger for the balance history', () => {
    const { component, service } = setup();
    component.openHistory(ROW);
    expect(service.getAdjustments).toHaveBeenCalledWith(7);
    expect(component.history().length).toBe(1);
  });
});
