import { EmployeeDetail } from '../../models/employee.model';
import { EmployeeKind } from '../../models/employee-kind.model';

export interface EmployeeTerminateDialogData {
  employee: EmployeeDetail;
  kind: EmployeeKind;
}
