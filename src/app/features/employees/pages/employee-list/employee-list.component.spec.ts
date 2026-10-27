import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';

import { EmployeeListComponent } from './employee-list.component';
import { EmployeeService } from '../../services/employee.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';

describe('EmployeeListComponent', () => {
  it('gives each row the displayed name so the Name column sorts and exports', () => {
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: Router, useValue: {} },
        { provide: MatDialog, useValue: {} },
        { provide: AuthService, useValue: { user: () => null } },
        { provide: ReferenceDataService, useValue: { getRolesAsOptions: () => of([]) } },
        {
          provide: EmployeeService,
          useValue: {
            getEmployeesPaged: () => of({
              items: [{ id: 1, firstName: 'Ben', lastName: 'Kelly', email: '', role: '', isActive: true, createdAt: '' }],
              totalCount: 1, page: 1, pageSize: 200,
            }),
          },
        },
      ],
    });
    const list = TestBed.runInInjectionContext(() => new EmployeeListComponent()) as unknown as {
      employees(): { name: string }[];
    };

    expect(list.employees()[0].name).toBe('Kelly, Ben');
  });
});

describe('EmployeeListComponent · status filter', () => {
  function setup() {
    const getEmployeesPaged = vi.fn(() => of({ items: [], totalCount: 0, page: 1, pageSize: 200 }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: Router, useValue: {} },
        { provide: MatDialog, useValue: {} },
        { provide: AuthService, useValue: { user: () => null } },
        { provide: ReferenceDataService, useValue: { getRolesAsOptions: () => of([]) } },
        { provide: EmployeeService, useValue: { getEmployeesPaged } },
      ],
    });
    const list = TestBed.runInInjectionContext(() => new EmployeeListComponent()) as unknown as {
      statusControl: { setValue(v: string | null): void };
      statusOptions: { value: unknown }[];
    };
    return { list, getEmployeesPaged };
  }

  it('offers a terminated filter that asks the API for terminated employees only', () => {
    const { list, getEmployeesPaged } = setup();
    expect(list.statusOptions.map(o => o.value)).toContain('terminated');

    list.statusControl.setValue('terminated');

    expect(getEmployeesPaged).toHaveBeenLastCalledWith(expect.objectContaining({ terminated: true, isActive: undefined }));
  });

  it('keeps terminated employees out of the inactive filter', () => {
    const { list, getEmployeesPaged } = setup();

    list.statusControl.setValue('inactive');

    expect(getEmployeesPaged).toHaveBeenLastCalledWith(expect.objectContaining({ isActive: false, terminated: false }));
  });
});
