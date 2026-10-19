import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';

import { EmployeeDetailComponent } from './employee-detail.component';
import { EmployeeService } from '../../services/employee.service';

describe('EmployeeDetailComponent', () => {
  it('loads stats for the employee the server resolved, not the raw route id', () => {
    const getEmployeeStats = vi.fn(() => of({}));
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: Router, useValue: {} },
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
