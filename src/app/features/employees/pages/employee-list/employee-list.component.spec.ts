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
