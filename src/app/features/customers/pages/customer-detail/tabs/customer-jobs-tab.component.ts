import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';

import { environment } from '../../../../../../environments/environment';
import { PagedResponse } from '../../../../../shared/models/paged-response.model';
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
  imports: [DatePipe, TranslatePipe, DataTableComponent, ColumnCellDirective],
  templateUrl: './customer-jobs-tab.component.html',
  styleUrl: '../customer-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerJobsTabComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly customerId = input.required<number>();

  protected readonly jobs = signal<CustomerJob[]>([]);
  protected readonly loading = signal(false);

  protected readonly columns: ColumnDef[] = [
    { field: 'jobNumber', header: this.translate.instant('customers.tabs.colJobNumber'), sortable: true, width: '90px' },
    { field: 'title', header: this.translate.instant('customers.tabs.colTitle'), sortable: true },
    { field: 'stageName', header: this.translate.instant('customers.tabs.colStage'), sortable: true, width: '140px' },
    { field: 'priority', header: this.translate.instant('customers.tabs.colPriority'), sortable: true, width: '90px' },
    { field: 'dueDate', header: this.translate.instant('customers.tabs.colDue'), sortable: true, type: 'date', width: '100px' },
    { field: 'createdAt', header: this.translate.instant('customers.colCreated'), sortable: true, type: 'date', width: '100px' },
  ];

  ngOnInit(): void {
    // Phase 3 F7-broad / WU-22 — server returns paged envelope on /jobs.
    this.loading.set(true);
    const params = new HttpParams()
      .set('customerId', String(this.customerId()))
      .set('pageSize', '200');
    this.http.get<PagedResponse<CustomerJob>>(`${environment.apiUrl}/jobs`, { params }).subscribe({
      next: paged => { this.jobs.set(paged.items); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openJob(job: CustomerJob): void {
    this.router.navigate(['/board'], { queryParams: { job: job.id } });
  }
}
