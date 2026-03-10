import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { JobsByStageItem } from '../models/jobs-by-stage-item.model';
import { OverdueJobItem } from '../models/overdue-job-item.model';
import { TimeByUserItem } from '../models/time-by-user-item.model';
import { ExpenseSummaryItem } from '../models/expense-summary-item.model';
import { LeadPipelineItem } from '../models/lead-pipeline-item.model';
import { JobCompletionTrendItem } from '../models/job-completion-trend-item.model';
import { OnTimeDeliveryItem } from '../models/on-time-delivery-item.model';
import { AverageLeadTimeItem } from '../models/average-lead-time-item.model';
import { TeamWorkloadItem } from '../models/team-workload-item.model';
import { CustomerActivityItem } from '../models/customer-activity-item.model';
import { MyWorkHistoryItem } from '../models/my-work-history-item.model';
import { MyTimeLogItem } from '../models/my-time-log-item.model';
import { ArAgingItem } from '../models/ar-aging-item.model';
import { RevenueItem } from '../models/revenue-item.model';
import { SimplePnlItem } from '../models/simple-pnl-item.model';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);

  getJobsByStage(trackTypeId?: number): Observable<JobsByStageItem[]> {
    let params = new HttpParams();
    if (trackTypeId) params = params.set('trackTypeId', trackTypeId.toString());
    return this.http.get<JobsByStageItem[]>(`${environment.apiUrl}/reports/jobs-by-stage`, { params });
  }

  getOverdueJobs(): Observable<OverdueJobItem[]> {
    return this.http.get<OverdueJobItem[]>(`${environment.apiUrl}/reports/overdue-jobs`);
  }

  getTimeByUser(start: string, end: string): Observable<TimeByUserItem[]> {
    return this.http.get<TimeByUserItem[]>(`${environment.apiUrl}/reports/time-by-user`, {
      params: { start, end },
    });
  }

  getExpenseSummary(start: string, end: string): Observable<ExpenseSummaryItem[]> {
    return this.http.get<ExpenseSummaryItem[]>(`${environment.apiUrl}/reports/expense-summary`, {
      params: { start, end },
    });
  }

  getLeadPipeline(): Observable<LeadPipelineItem[]> {
    return this.http.get<LeadPipelineItem[]>(`${environment.apiUrl}/reports/lead-pipeline`);
  }

  getJobCompletionTrend(months: number = 6): Observable<JobCompletionTrendItem[]> {
    return this.http.get<JobCompletionTrendItem[]>(`${environment.apiUrl}/reports/job-completion-trend`, {
      params: { months: months.toString() },
    });
  }

  getOnTimeDelivery(start: string, end: string): Observable<OnTimeDeliveryItem> {
    return this.http.get<OnTimeDeliveryItem>(`${environment.apiUrl}/reports/on-time-delivery`, {
      params: { start, end },
    });
  }

  getAverageLeadTime(): Observable<AverageLeadTimeItem[]> {
    return this.http.get<AverageLeadTimeItem[]>(`${environment.apiUrl}/reports/average-lead-time`);
  }

  getTeamWorkload(): Observable<TeamWorkloadItem[]> {
    return this.http.get<TeamWorkloadItem[]>(`${environment.apiUrl}/reports/team-workload`);
  }

  getCustomerActivity(): Observable<CustomerActivityItem[]> {
    return this.http.get<CustomerActivityItem[]>(`${environment.apiUrl}/reports/customer-activity`);
  }

  getMyWorkHistory(): Observable<MyWorkHistoryItem[]> {
    return this.http.get<MyWorkHistoryItem[]>(`${environment.apiUrl}/reports/my-work-history`);
  }

  getMyTimeLog(start: string, end: string): Observable<MyTimeLogItem[]> {
    return this.http.get<MyTimeLogItem[]>(`${environment.apiUrl}/reports/my-time-log`, {
      params: { start, end },
    });
  }

  // ─── Financial Reports ───

  getArAging(): Observable<ArAgingItem[]> {
    return this.http.get<ArAgingItem[]>(`${environment.apiUrl}/reports/ar-aging`);
  }

  getRevenue(start: string, end: string, groupBy: string = 'period'): Observable<RevenueItem[]> {
    return this.http.get<RevenueItem[]>(`${environment.apiUrl}/reports/revenue`, {
      params: { start, end, groupBy },
    });
  }

  getSimplePnl(start: string, end: string): Observable<SimplePnlItem[]> {
    return this.http.get<SimplePnlItem[]>(`${environment.apiUrl}/reports/simple-pnl`, {
      params: { start, end },
    });
  }
}
