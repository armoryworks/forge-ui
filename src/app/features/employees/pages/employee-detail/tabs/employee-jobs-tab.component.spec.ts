import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { provideTranslateService } from '@ngx-translate/core';

import { EmployeeJobsTabComponent } from './employee-jobs-tab.component';
import { EmployeeService } from '../../../services/employee.service';
import { EmployeeJob } from '../../../models/employee.model';

describe('EmployeeJobsTabComponent', () => {
  it('opens the job detail on the board through the detail param the board reads', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideTranslateService(), { provide: EmployeeService, useValue: {} }],
    });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const tab = TestBed.runInInjectionContext(() => new EmployeeJobsTabComponent()) as unknown as { openJob(job: EmployeeJob): void };

    tab.openJob({ id: 31 } as EmployeeJob);

    expect(navigate).toHaveBeenCalledWith(['/kanban'], { queryParams: { detail: 'job:31' } });
  });
});
