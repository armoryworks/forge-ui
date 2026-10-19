import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';

import { EmployeeService } from '../../../services/employee.service';
import { EmployeeCompliance, EmployeeComplianceCheck } from '../../../models/employee.model';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../../shared/models/column-def.model';

@Component({
  selector: 'app-employee-compliance-tab',
  standalone: true,
  imports: [DatePipe, TranslatePipe, DataTableComponent, ColumnCellDirective],
  templateUrl: './employee-compliance-tab.component.html',
  styleUrl: '../employee-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeComplianceTabComponent implements OnInit {
  private readonly employeeService = inject(EmployeeService);

  readonly employeeId = input.required<number>();
  readonly checklist = input<EmployeeComplianceCheck[]>([]);

  private readonly checkLabels: Partial<Record<string, string>> = {
    w4: 'employees.detail.checklist.w4',
    i9: 'employees.detail.checklist.i9',
    stateWithholding: 'employees.detail.checklist.stateWithholding',
    emergencyContact: 'employees.detail.checklist.emergencyContact',
    address: 'employees.detail.checklist.address',
    directDeposit: 'employees.detail.checklist.directDeposit',
    workersComp: 'employees.detail.checklist.workersComp',
    handbook: 'employees.detail.checklist.handbook',
  };

  protected readonly items = signal<EmployeeCompliance[]>([]);
  protected readonly loading = signal(false);

  protected readonly columns: ColumnDef[] = [
    { field: 'formName', header: 'Form', sortable: true },
    { field: 'formType', header: 'Type', sortable: true, width: '120px' },
    { field: 'status', header: 'Status', sortable: true, width: '110px' },
    { field: 'signedAt', header: 'Signed', sortable: true, type: 'date', width: '100px' },
    { field: 'createdAt', header: 'Created', sortable: true, type: 'date', width: '100px' },
  ];

  protected checkLabel(key: string): string {
    return this.checkLabels[key] ?? key;
  }

  ngOnInit(): void {
    this.loading.set(true);
    this.employeeService.getCompliance(this.employeeId()).subscribe({
      next: data => { this.items.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Completed: 'chip--success',
      Signed: 'chip--success',
      Pending: 'chip--warning',
      Expired: 'chip--error',
    };
    return map[status] ?? 'chip--muted';
  }
}
