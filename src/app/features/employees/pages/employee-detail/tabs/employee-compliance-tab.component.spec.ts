import { TestBed } from '@angular/core/testing';

import { EmployeeComplianceTabComponent } from './employee-compliance-tab.component';
import { EmployeeService } from '../../../services/employee.service';

describe('EmployeeComplianceTabComponent', () => {
  it('labels each checklist item the server sends', () => {
    TestBed.configureTestingModule({ providers: [{ provide: EmployeeService, useValue: {} }] });
    const tab = TestBed.runInInjectionContext(() => new EmployeeComplianceTabComponent()) as unknown as {
      checkLabel(key: string): string;
    };

    expect(tab.checkLabel('emergencyContact')).toBe('employees.detail.checklist.emergencyContact');
    expect(tab.checkLabel('unknown')).toBe('unknown');
  });
});
