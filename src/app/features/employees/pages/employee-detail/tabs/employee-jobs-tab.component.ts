import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { EmployeeService } from '../../../services/employee.service';
import { EmployeeJob } from '../../../models/employee.model';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../../shared/models/column-def.model';
import { DateOnlyPipe } from '../../../../../shared/pipes/date-only.pipe';

@Component({
  selector: 'app-employee-jobs-tab',
  standalone: true,
  imports: [DateOnlyPipe, DataTableComponent, ColumnCellDirective, TranslatePipe],
  templateUrl: './employee-jobs-tab.component.html',
  styleUrl: '../employee-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeJobsTabComponent implements OnInit {
  private readonly employeeService = inject(EmployeeService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly employeeId = input.required<number>();

  protected readonly jobs = signal<EmployeeJob[]>([]);
  protected readonly loading = signal(false);

  protected readonly columns: ColumnDef[] = [
    { field: 'jobNumber', header: this.translate.instant('employees.detail.jobsTab.colJobNumber'), sortable: true, width: '90px' },
    { field: 'title', header: this.translate.instant('employees.detail.jobsTab.colTitle'), sortable: true },
    { field: 'trackTypeName', header: this.translate.instant('employees.detail.jobsTab.colTrack'), sortable: true, width: '120px' },
    { field: 'stageName', header: this.translate.instant('employees.detail.jobsTab.colStage'), sortable: true, width: '140px' },
    { field: 'priority', header: this.translate.instant('employees.detail.jobsTab.colPriority'), sortable: true, width: '90px' },
    { field: 'dueDate', header: this.translate.instant('employees.detail.jobsTab.colDue'), sortable: true, type: 'date', width: '100px' },
  ];

  ngOnInit(): void {
    this.loading.set(true);
    this.employeeService.getJobs(this.employeeId()).subscribe({
      next: data => { this.jobs.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openJob(job: EmployeeJob): void {
    this.router.navigate(['/kanban'], { queryParams: { detail: `job:${job.id}` } });
  }
}
