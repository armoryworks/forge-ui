import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { LeaveApprovalsComponent } from './leave-approvals.component';
import { LeaveService } from '../../services/leave.service';
import { LeaveRequest } from '../../models/leave-request.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface ApprovalsInternals {
  statusControl: FormControl<string>;
  denyNoteControl: FormControl<string>;
  rows: () => { id: number; actionable: boolean }[];
  approve(request: LeaveRequest): void;
  openDeny(request: LeaveRequest): void;
  deny(): void;
}

const REQUEST: LeaveRequest = {
  id: 9, userId: 3, userName: 'Ortiz, Rosa', policyId: 2, policyName: 'PTO', startDate: '2026-11-02', endDate: '2026-11-03',
  hours: 16, status: 'Pending', approvedById: null, approvedByName: null, decidedAt: null, reason: 'Family', denialReason: null,
  createdAt: '2026-10-26T15:00:00Z',
};

function setup() {
  const service = {
    getRequests: vi.fn().mockReturnValue(of([REQUEST])),
    approveRequest: vi.fn().mockReturnValue(of(undefined)),
    denyRequest: vi.fn().mockReturnValue(of(undefined)),
  };
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: LeaveService, useValue: service },
      { provide: AuthService, useValue: { user: () => ({ id: 1 }) } },
      { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new LeaveApprovalsComponent()) as unknown as ApprovalsInternals;
  return { component, service };
}

describe('LeaveApprovalsComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('opens on pending requests and reloads when the status filter changes', () => {
    const { component, service } = setup();
    expect(service.getRequests).toHaveBeenCalledWith(null, 'Pending');

    component.statusControl.setValue('');
    expect(service.getRequests).toHaveBeenLastCalledWith(null, null);
  });

  it('keeps rows read-only unless the viewer may decide', () => {
    const { component } = setup();
    expect(component.rows()[0].actionable).toBe(false);
  });

  it('approves and denies through the service with the note', () => {
    const { component, service } = setup();
    component.approve(REQUEST);
    expect(service.approveRequest).toHaveBeenCalledWith(9);

    component.openDeny(REQUEST);
    component.denyNoteControl.setValue('  Short-staffed that week ');
    component.deny();
    expect(service.denyRequest).toHaveBeenCalledWith(9, 'Short-staffed that week');
  });
});
