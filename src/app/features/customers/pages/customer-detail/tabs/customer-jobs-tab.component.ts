import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../../shared/models/column-def.model';

interface CustomerJob {
  id: number;
  jobNumber: string;
  title: string;
  stageName?: string;
  stageColor?: string;
  priority?: string;
  dueDate?: string;
  createdAt: string;
}

@Component({
  selector: 'app-customer-jobs-tab',
  standalone: true,
  imports: [DatePipe, DataTableComponent, ColumnCellDirective],
  templateUrl: './customer-jobs-tab.component.html',
  styleUrl: '../customer-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerJobsTabComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly customerId = input.required<number>();

  protected readonly jobs = signal<CustomerJob[]>([]);
  protected readonly loading = signal(false);

  protected readonly columns: ColumnDef[] = [
    { field: 'jobNumber', header: 'Job #', sortable: true, width: '90px' },
    { field: 'title', header: 'Title', sortable: true },
    { field: 'stageName', header: 'Stage', sortable: true, width: '140px' },
    { field: 'priority', header: 'Priority', sortable: true, width: '90px' },
    { field: 'dueDate', header: 'Due', sortable: true, type: 'date', width: '100px' },
    { field: 'createdAt', header: 'Created', sortable: true, type: 'date', width: '100px' },
  ];

  ngOnInit(): void {
    this.loading.set(true);
    const params = new HttpParams().set('customerId', String(this.customerId()));
    this.http.get<CustomerJob[]>(`${environment.apiUrl}/jobs`, { params }).subscribe({
      next: data => { this.jobs.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openJob(job: CustomerJob): void {
    this.router.navigate(['/board'], { queryParams: { job: job.id } });
  }
}
