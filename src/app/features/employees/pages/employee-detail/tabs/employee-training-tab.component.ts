import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';

import { EmployeeService } from '../../../services/employee.service';
import { EmployeeTraining } from '../../../models/employee.model';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../../shared/models/column-def.model';

@Component({
  selector: 'app-employee-training-tab',
  standalone: true,
  imports: [DatePipe, DataTableComponent, ColumnCellDirective],
  templateUrl: './employee-training-tab.component.html',
  styleUrl: '../employee-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeTrainingTabComponent implements OnInit {
  private readonly employeeService = inject(EmployeeService);

  readonly employeeId = input.required<number>();

  protected readonly items = signal<EmployeeTraining[]>([]);
  protected readonly loading = signal(false);

  protected readonly columns: ColumnDef[] = [
    { field: 'moduleName', header: 'Module', sortable: true },
    { field: 'moduleType', header: 'Type', sortable: true, width: '100px' },
    { field: 'status', header: 'Status', sortable: true, width: '110px' },
    { field: 'quizScore', header: 'Score', sortable: true, width: '70px', align: 'center' },
    { field: 'startedAt', header: 'Started', sortable: true, type: 'date', width: '100px' },
    { field: 'completedAt', header: 'Completed', sortable: true, type: 'date', width: '100px' },
  ];

  ngOnInit(): void {
    this.loading.set(true);
    this.employeeService.getTraining(this.employeeId()).subscribe({
      next: data => { this.items.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Completed: 'chip--success',
      InProgress: 'chip--info',
      NotStarted: 'chip--muted',
      Failed: 'chip--error',
    };
    return map[status] ?? 'chip--muted';
  }
}
