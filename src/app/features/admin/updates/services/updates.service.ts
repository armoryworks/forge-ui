import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { DeployAvailability, DeployJob, DeployState } from '../models/update.model';

/**
 * Client for `/api/v1/admin/updates`. Admin-only server-side.
 *
 * Nothing here talks to the deploy agent directly — the API holds the agent
 * token and does the auditing. The browser never sees either.
 */
@Injectable({ providedIn: 'root' })
export class UpdatesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/updates`;

  getState(): Observable<DeployState> {
    return this.http.get<DeployState>(`${this.base}/state`);
  }

  getAvailability(): Observable<DeployAvailability> {
    return this.http.get<DeployAvailability>(`${this.base}/available`);
  }

  startJob(body: {
    action: string;
    service?: string | null;
    tag?: string | null;
    confirm?: string | null;
    approvedFromJobId?: string | null;
  }): Observable<DeployJob> {
    return this.http.post<DeployJob>(`${this.base}/jobs`, body);
  }

  getJob(jobId: string): Observable<DeployJob> {
    return this.http.get<DeployJob>(`${this.base}/jobs/${jobId}`);
  }

  getJobLog(jobId: string, offset: number): Observable<string> {
    return this.http.get(`${this.base}/jobs/${jobId}/log`, {
      params: new HttpParams().set('offset', offset),
      responseType: 'text',
    });
  }
}
