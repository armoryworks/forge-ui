import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Project } from '../models/project.model';
import { ProjectPage } from '../models/project-page.model';
import { ProjectStatus } from '../models/project-status.model';
import { ProjectSummary } from '../models/project-summary.model';
import { EarnedValue } from '../models/earned-value.model';
import { ProjectJob } from '../models/project-job.model';
import { CreateProjectRequest } from '../models/create-project-request.model';
import { UpdateProjectRequest } from '../models/update-project-request.model';
import { CreateWbsElementRequest } from '../models/create-wbs-element-request.model';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/projects`;

  list(filter: { status?: ProjectStatus | null; page?: number; pageSize?: number }): Observable<ProjectPage> {
    let params = new HttpParams().set('page', filter.page ?? 1).set('pageSize', filter.pageSize ?? 100);
    if (filter.status) params = params.set('status', filter.status);
    return this.http.get<ProjectPage>(this.base, { params });
  }

  get(id: number): Observable<Project> {
    return this.http.get<Project>(`${this.base}/${id}`);
  }

  create(request: CreateProjectRequest): Observable<Project> {
    return this.http.post<Project>(this.base, request);
  }

  update(id: number, request: UpdateProjectRequest): Observable<Project> {
    return this.http.put<Project>(`${this.base}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  summary(id: number): Observable<ProjectSummary> {
    return this.http.get<ProjectSummary>(`${this.base}/${id}/summary`);
  }

  earnedValue(id: number): Observable<EarnedValue> {
    return this.http.get<EarnedValue>(`${this.base}/${id}/earned-value`);
  }

  recalculate(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/recalculate`, {});
  }

  addWbsElement(id: number, request: CreateWbsElementRequest): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${this.base}/${id}/wbs`, request);
  }

  deleteWbsElement(id: number, elementId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/wbs/${elementId}`);
  }

  jobs(id: number): Observable<ProjectJob[]> {
    return this.http.get<ProjectJob[]>(`${this.base}/${id}/jobs`);
  }

  linkJob(id: number, elementId: number, jobId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/wbs/${elementId}/link-job`, { jobId });
  }

  unlinkJob(id: number, elementId: number, jobId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/wbs/${elementId}/jobs/${jobId}`);
  }
}
