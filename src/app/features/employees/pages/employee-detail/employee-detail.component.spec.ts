import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';

import { NavTreeService } from '../../../../shared/services/nav-tree.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { EmployeeService } from '../../services/employee.service';
import { EmployeeDetail } from '../../models/employee.model';
import { EmployeeDetailComponent } from './employee-detail.component';

function shellProviders(roles: string[] = ['Admin'], capabilityOn = true, callerId = 1, open = vi.fn()) {
  return [
    { provide: AuthService, useValue: { user: () => ({ id: callerId }), hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
    { provide: CapabilityService, useValue: { isEnabled: () => capabilityOn } },
    { provide: MatDialog, useValue: { open } },
  ];
}

describe('EmployeeDetailComponent', () => {
  it('loads stats for the employee the server resolved, not the raw route id', () => {
    const getEmployeeStats = vi.fn(() => of({}));
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: Router, useValue: {} },
        { provide: NavTreeService, useValue: { setRecordCrumb: vi.fn() } },
        ...shellProviders(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({})),
            queryParamMap: of(convertToParamMap({})),
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
        {
          provide: EmployeeService,
          useValue: { getEmployee: () => of({ id: 12, hasLogin: true }), getEmployeeStats },
        },
      ],
    });
    const detail = TestBed.runInInjectionContext(() => new EmployeeDetailComponent()) as unknown as {
      loadEmployee(id: number, kind: string | null): void;
    };

    detail.loadEmployee(5, 'profile');

    expect(getEmployeeStats).toHaveBeenCalledWith(12);
  });
});

describe('EmployeeDetailComponent · bad links', () => {
  function setup(id: string, getEmployee: () => Observable<EmployeeDetail>) {
    const navigate = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id, tab: 'overview' })), queryParamMap: of(convertToParamMap({})), snapshot: { queryParamMap: convertToParamMap({}) } } },
        { provide: Router, useValue: { navigate } },
        { provide: NavTreeService, useValue: { setRecordCrumb: vi.fn() } },
        ...shellProviders(),
        { provide: EmployeeService, useValue: { getEmployee: vi.fn(getEmployee), getEmployeeStats: vi.fn(() => of(null)) } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new EmployeeDetailComponent());
    TestBed.flushEffects();
    const view = component as unknown as { loading(): boolean; loadError(): unknown };
    return { view, navigate, service: TestBed.inject(EmployeeService) };
  }

  beforeEach(() => TestBed.resetTestingModule());

  it.each(['abc', '0'])('shows not-found in place for id %j without calling the API', (id) => {
    const { view, navigate, service } = setup(id, () => of({} as EmployeeDetail));
    expect(view.loading()).toBe(false);
    expect((view.loadError() as HttpErrorResponse).status).toBe(404);
    expect(service.getEmployee).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps the page and shows the error when the employee does not exist', () => {
    const missing = new HttpErrorResponse({ status: 404 });
    const { view, navigate } = setup('999999', () => throwError(() => missing));
    expect(view.loadError()).toBe(missing);
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('EmployeeDetailComponent · termination', () => {
  interface TerminationView {
    loadEmployee(id: number, kind: string | null): void;
    canTerminate(): boolean;
    terminationVisible(): boolean;
    isTerminated(): boolean;
    terminationScheduled(): boolean;
    openTerminate(): void;
  }

  function setup(employee: Partial<EmployeeDetail>, roles: string[], capabilityOn = true, callerId = 1) {
    const open = vi.fn(() => ({ afterClosed: () => of(null) }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NavTreeService, useValue: { setRecordCrumb: vi.fn() } },
        ...shellProviders(roles, capabilityOn, callerId, open),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({})),
            queryParamMap: of(convertToParamMap({})),
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
        {
          provide: EmployeeService,
          useValue: { getEmployee: () => of({ id: 12, hasLogin: true, firstName: 'Ann', lastName: 'Lee', ...employee }), getEmployeeStats: () => of(null) },
        },
      ],
    });
    const view = TestBed.runInInjectionContext(() => new EmployeeDetailComponent()) as unknown as TerminationView;
    view.loadEmployee(12, 'user');
    return { view, open };
  }

  it('offers Terminate to an Admin or Manager while the capability is on', () => {
    expect(setup({}, ['Admin']).view.canTerminate()).toBe(true);
    expect(setup({}, ['Manager']).view.canTerminate()).toBe(true);
  });

  it('hides Terminate from other roles and when the capability is off', () => {
    expect(setup({}, ['OfficeManager']).view.canTerminate()).toBe(false);
    expect(setup({}, ['Admin'], false).view.canTerminate()).toBe(false);
    expect(setup({}, ['Admin'], false).view.terminationVisible()).toBe(false);
  });

  it('hides Terminate on the caller\'s own record and once a termination exists', () => {
    expect(setup({}, ['Admin'], true, 12).view.canTerminate()).toBe(false);
    const { view } = setup({ termination: { terminationDate: '2026-10-01T00:00:00Z', reasonCode: 'layoff', rehireEligible: true, finalPayRequired: true, appliedAt: '2026-10-01T10:00:00Z' } }, ['Admin']);
    expect(view.canTerminate()).toBe(false);
    expect(view.isTerminated()).toBe(true);
  });

  it('flags a termination that is still scheduled', () => {
    const { view } = setup({ termination: { terminationDate: '2026-12-01T00:00:00Z', reasonCode: 'retirement', rehireEligible: false, finalPayRequired: true, appliedAt: null } }, ['Admin']);
    expect(view.terminationScheduled()).toBe(true);
    expect(view.isTerminated()).toBe(false);
  });

  it('opens the terminate dialog for the loaded employee', () => {
    const { view, open } = setup({}, ['Admin']);
    view.openTerminate();
    expect(open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ data: expect.objectContaining({ kind: 'user' }) }));
  });
});
