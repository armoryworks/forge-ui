import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { provideTranslateService, TranslateService } from '@ngx-translate/core';

import { NavTreeService } from '../../../../shared/services/nav-tree.service';
import { EmployeeService } from '../../services/employee.service';
import { EmployeeDetail } from '../../models/employee.model';
import { EmployeeDetailComponent } from './employee-detail.component';

describe('EmployeeDetailComponent', () => {
  it('loads stats for the employee the server resolved, not the raw route id', () => {
    const getEmployeeStats = vi.fn(() => of({}));
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: Router, useValue: {} },
        { provide: NavTreeService, useValue: { setRecordCrumb: vi.fn() } },
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
