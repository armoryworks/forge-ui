import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { EmployeeService } from '../../../services/employee.service';
import { EmployeeTimeEntry } from '../../../models/employee.model';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { ColumnDef } from '../../../../../shared/models/column-def.model';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';

@Component({
  selector: 'app-employee-time-tab',
  standalone: true,
  imports: [ReactiveFormsModule, DataTableComponent, SelectComponent],
  templateUrl: './employee-time-tab.component.html',
  styleUrl: '../employee-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeTimeTabComponent implements OnInit {
  private readonly employeeService = inject(EmployeeService);

  readonly employeeId = input.required<number>();

  protected readonly entries = signal<EmployeeTimeEntry[]>([]);
  protected readonly loading = signal(false);

  protected readonly periodControl = new FormControl('pay-period');
  protected readonly periodOptions: SelectOption[] = [
    { value: 'week', label: 'This Week' },
    { value: 'pay-period', label: 'Pay Period (2 Weeks)' },
    { value: 'month', label: 'This Month' },
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'date', header: 'Date', sortable: true, type: 'date', width: '100px' },
    { field: 'durationMinutes', header: 'Duration', sortable: true, width: '90px', align: 'right' },
    { field: 'category', header: 'Category', sortable: true, width: '120px' },
    { field: 'jobNumber', header: 'Job #', sortable: true, width: '90px' },
    { field: 'jobTitle', header: 'Job Title', sortable: true },
    { field: 'notes', header: 'Notes', sortable: false },
    { field: 'isManual', header: 'Type', sortable: true, width: '80px' },
  ];

  ngOnInit(): void {
    this.loadData();
  }

  protected loadData(): void {
    this.loading.set(true);
    const period = this.periodControl.value ?? undefined;
    this.employeeService.getTimeSummary(this.employeeId(), period).subscribe({
      next: data => { this.entries.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected onPeriodChange(): void {
    this.loadData();
  }
}
