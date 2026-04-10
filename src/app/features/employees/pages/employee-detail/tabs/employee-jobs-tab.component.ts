import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { EmployeeService } from '../../../services/employee.service';
import { EmployeeJob } from '../../../models/employee.model';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../../shared/models/column-def.model';

@Component({
  selector: 'app-employee-jobs-tab',
  standalone: true,
  imports: [DatePipe, DataTableComponent, ColumnCellDirective],
  templateUrl: './employee-jobs-tab.component.html',
  styleUrl: '../employee-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeJobsTabComponent implements OnInit {
  private readonly employeeService = inject(EmployeeService);
  private readonly router = inject(Router);

  readonly employeeId = input.required<number>();

  protected readonly jobs = signal<EmployeeJob[]>([]);
  protected readonly loading = signal(false);

  protected readonly columns: ColumnDef[] = [
    { field: 'jobNumber', header: 'Job #', sortable: true, width: '90px' },
    { field: 'title', header: 'Title', sortable: true },
    { field: 'trackTypeName', header: 'Track', sortable: true, width: '120px' },
    { field: 'stageName', header: 'Stage', sortable: true, width: '140px' },
    { field: 'priority', header: 'Priority', sortable: true, width: '90px' },
    { field: 'dueDate', header: 'Due', sortable: true, type: 'date', width: '100px' },
  ];

  ngOnInit(): void {
    this.loading.set(true);
    this.employeeService.getJobs(this.employeeId()).subscribe({
      next: data => { this.jobs.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openJob(job: EmployeeJob): void {
    this.router.navigate(['/kanban'], { queryParams: { job: job.id } });
  }
}
