import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { MyLeaveComponent } from './my-leave.component';
import { LeaveService } from '../../services/leave.service';
import { LeaveRequest } from '../../models/leave-request.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface MyLeaveInternals {
  form: FormGroup;
  pendingHours: () => number;
  rows: () => (LeaveRequest & { chipClass: string })[];
  openRequest(): void;
  submitRequest(): void;
  cancelRequest(request: LeaveRequest): void;
}

const PENDING: LeaveRequest = {
  id: 4, userId: 7, userName: 'Kelly, Ben', policyId: 2, policyName: 'PTO', startDate: '2026-11-02', endDate: '2026-11-02',
  hours: 8, status: 'Pending', approvedById: null, approvedByName: null, decidedAt: null, reason: null, denialReason: null,
  createdAt: '2026-10-26T15:00:00Z',
};

function setup(confirm = true) {
  const service = {
    getBalances: vi.fn().mockReturnValue(of([{ id: 1, userId: 7, policyId: 2, policyName: 'PTO', balance: 24, usedThisYear: 0, accruedThisYear: 24, lastAccrualDate: '2026-10-18' }])),
    getRequests: vi.fn().mockReturnValue(of([PENDING])),
    getPolicies: vi.fn().mockReturnValue(of([{ id: 2, name: 'PTO' }])),
    createRequest: vi.fn().mockReturnValue(of(PENDING)),
    cancelRequest: vi.fn().mockReturnValue(of(undefined)),
  };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(confirm) })) };
  const snackbar = { success: vi.fn(), errorFrom: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: LeaveService, useValue: service },
      { provide: AuthService, useValue: { user: () => ({ id: 7 }) } },
      { provide: MatDialog, useValue: dialog },
      { provide: SnackbarService, useValue: snackbar },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new MyLeaveComponent()) as unknown as MyLeaveInternals;
  return { component, service, dialog };
}

describe('MyLeaveComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the signed-in employee\'s balances and requests', () => {
    const { component, service } = setup();
    expect(service.getBalances).toHaveBeenCalledWith(7);
    expect(service.getRequests).toHaveBeenCalledWith(7);
    expect(component.pendingHours()).toBe(8);
    expect(component.rows()[0].chipClass).toBe('chip--warning');
  });

  it('suggests eight hours per weekday and submits date-only values', () => {
    const { component, service } = setup();
    component.openRequest();
    component.form.patchValue({ startDate: new Date(2026, 10, 6), endDate: new Date(2026, 10, 9) });

    expect(component.form.get('hours')!.value).toBe(16);
    expect(component.form.get('policyId')!.value).toBe(2);
    component.submitRequest();

    expect(service.createRequest).toHaveBeenCalledWith({
      policyId: 2, startDate: '2026-11-06', endDate: '2026-11-09', hours: 16, reason: null,
    });
  });

  it('refuses a last day before the first day', () => {
    const { component, service } = setup();
    component.openRequest();
    component.form.patchValue({ startDate: new Date(2026, 10, 9), endDate: new Date(2026, 10, 6), hours: 8 });

    component.submitRequest();

    expect(component.form.hasError('endBeforeStart')).toBe(true);
    expect(service.createRequest).not.toHaveBeenCalled();
  });

  it('cancels a pending request only after the confirm', () => {
    const declined = setup(false);
    declined.component.cancelRequest(PENDING);
    expect(declined.service.cancelRequest).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    const confirmed = setup(true);
    confirmed.component.cancelRequest(PENDING);
    expect(confirmed.service.cancelRequest).toHaveBeenCalledWith(4);
  });
});
