import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TrackType, KanbanJob, BoardColumn, JobDetail, Subtask, Activity, CustomerRef, UserRef, JobLink, BulkResult } from '../models/kanban.model';

@Injectable({ providedIn: 'root' })
export class KanbanService {
  private readonly http = inject(HttpClient);

  getTrackTypes(): Observable<TrackType[]> {
    return this.http.get<TrackType[]>(`${environment.apiUrl}/track-types`);
  }

  getBoard(trackTypeId: number): Observable<BoardColumn[]> {
    return forkJoin({
      trackType: this.http.get<TrackType>(`${environment.apiUrl}/track-types/${trackTypeId}`),
      jobs: this.http.get<KanbanJob[]>(`${environment.apiUrl}/jobs`, {
        params: { trackTypeId: trackTypeId.toString(), isArchived: 'false' },
      }),
    }).pipe(map(({ trackType, jobs }) => this.buildBoard(trackType, jobs)));
  }

  moveJobStage(jobId: number, stageId: number): Observable<unknown> {
    return this.http.patch(`${environment.apiUrl}/jobs/${jobId}/stage`, { stageId });
  }

  updateJobPosition(jobId: number, position: number): Observable<void> {
    return this.http.patch<void>(`${environment.apiUrl}/jobs/${jobId}/position`, { position });
  }

  getJobDetail(id: number): Observable<JobDetail> {
    return this.http.get<JobDetail>(`${environment.apiUrl}/jobs/${id}`);
  }

  getSubtasks(jobId: number): Observable<Subtask[]> {
    return this.http.get<Subtask[]>(`${environment.apiUrl}/jobs/${jobId}/subtasks`);
  }

  getJobActivity(jobId: number): Observable<Activity[]> {
    return this.http.get<Activity[]>(`${environment.apiUrl}/jobs/${jobId}/activity`);
  }

  addComment(jobId: number, comment: string): Observable<Activity> {
    return this.http.post<Activity>(`${environment.apiUrl}/jobs/${jobId}/comments`, { comment });
  }

  toggleSubtask(jobId: number, subtaskId: number, isCompleted: boolean): Observable<unknown> {
    return this.http.patch(`${environment.apiUrl}/jobs/${jobId}/subtasks/${subtaskId}`, { isCompleted });
  }

  addSubtask(jobId: number, text: string): Observable<Subtask> {
    return this.http.post<Subtask>(`${environment.apiUrl}/jobs/${jobId}/subtasks`, { text });
  }

  getCustomers(): Observable<CustomerRef[]> {
    return this.http.get<CustomerRef[]>(`${environment.apiUrl}/customers`);
  }

  getUsers(): Observable<UserRef[]> {
    return this.http.get<UserRef[]>(`${environment.apiUrl}/users`);
  }

  createJob(command: {
    title: string;
    description?: string;
    trackTypeId: number;
    assigneeId?: number | null;
    customerId?: number | null;
    priority?: string;
    dueDate?: string | null;
  }): Observable<JobDetail> {
    return this.http.post<JobDetail>(`${environment.apiUrl}/jobs`, command);
  }

  updateJob(id: number, changes: Partial<JobDetail>): Observable<unknown> {
    return this.http.put(`${environment.apiUrl}/jobs/${id}`, changes);
  }

  getJobLinks(jobId: number): Observable<JobLink[]> {
    return this.http.get<JobLink[]>(`${environment.apiUrl}/jobs/${jobId}/links`);
  }

  createJobLink(jobId: number, targetJobId: number, linkType: string): Observable<JobLink> {
    return this.http.post<JobLink>(`${environment.apiUrl}/jobs/${jobId}/links`, { targetJobId, linkType });
  }

  deleteJobLink(jobId: number, linkId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/jobs/${jobId}/links/${linkId}`);
  }

  searchJobs(search: string): Observable<KanbanJob[]> {
    return this.http.get<KanbanJob[]>(`${environment.apiUrl}/jobs`, {
      params: { search, isArchived: 'false' },
    });
  }

  bulkMoveStage(jobIds: number[], stageId: number): Observable<BulkResult> {
    return this.http.patch<BulkResult>(`${environment.apiUrl}/jobs/bulk/stage`, { jobIds, stageId });
  }

  bulkAssign(jobIds: number[], assigneeId: number | null): Observable<BulkResult> {
    return this.http.patch<BulkResult>(`${environment.apiUrl}/jobs/bulk/assign`, { jobIds, assigneeId });
  }

  bulkSetPriority(jobIds: number[], priority: string): Observable<BulkResult> {
    return this.http.patch<BulkResult>(`${environment.apiUrl}/jobs/bulk/priority`, { jobIds, priority });
  }

  bulkArchive(jobIds: number[]): Observable<BulkResult> {
    return this.http.patch<BulkResult>(`${environment.apiUrl}/jobs/bulk/archive`, { jobIds });
  }

  private buildBoard(trackType: TrackType, jobs: KanbanJob[]): BoardColumn[] {
    const jobsByStage = new Map<string, KanbanJob[]>();
    for (const job of jobs) {
      const list = jobsByStage.get(job.stageName) ?? [];
      list.push(job);
      jobsByStage.set(job.stageName, list);
    }
    return trackType.stages.map(stage => ({
      stage,
      jobs: jobsByStage.get(stage.name) ?? [],
    }));
  }
}
