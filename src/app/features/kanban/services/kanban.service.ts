import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, forkJoin } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { TrackType } from '../../../shared/models/track-type.model';
import { ActivityItem } from '../../../shared/models/activity.model';
import { KanbanJob } from '../models/kanban-job.model';
import { BoardColumn } from '../models/board-column.model';
import { JobDetail } from '../models/job-detail.model';
import { Subtask } from '../models/subtask.model';
import { Activity } from '../models/activity.model';
import { CustomerRef } from '../models/customer-ref.model';
import { UserRef } from '../models/user-ref.model';
import { JobLink } from '../models/job-link.model';
import { BulkResult } from '../models/bulk-result.model';
import { FileAttachment } from '../../../shared/models/file.model';
import { TimeEntry } from '../../time-tracking/models/time-entry.model';
import { JobPart } from '../models/job-part.model';
import { JobNote } from '../models/job-note.model';
import { PartSearchResult } from '../models/part-search-result.model';
import { CustomFieldValues } from '../models/custom-field-values.model';
import { DisposeJobRequest } from '../models/dispose-job-request.model';
import { ChildJob } from '../models/child-job.model';
import { BomExplosionResponse } from '../models/bom-explosion-response.model';

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

  addComment(jobId: number, comment: string, mentionedUserIds: number[] = []): Observable<Activity> {
    return this.http.post<Activity>(`${environment.apiUrl}/jobs/${jobId}/comments`, { comment, mentionedUserIds });
  }

  toggleSubtask(jobId: number, subtaskId: number, isCompleted: boolean): Observable<unknown> {
    return this.http.patch(`${environment.apiUrl}/jobs/${jobId}/subtasks/${subtaskId}`, { isCompleted });
  }

  addSubtask(jobId: number, text: string): Observable<Subtask> {
    return this.http.post<Subtask>(`${environment.apiUrl}/jobs/${jobId}/subtasks`, { text });
  }

  getCustomers(): Observable<CustomerRef[]> {
    return this.http.get<CustomerRef[]>(`${environment.apiUrl}/customers/dropdown`);
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

  getJobFiles(jobId: number): Observable<FileAttachment[]> {
    return this.http.get<FileAttachment[]>(`${environment.apiUrl}/jobs/${jobId}/files`);
  }

  deleteJobFile(fileId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/files/${fileId}`);
  }

  downloadFileUrl(fileId: number): string {
    return `${environment.apiUrl}/files/${fileId}`;
  }

  getJobTimeEntries(jobId: number): Observable<TimeEntry[]> {
    return this.http.get<TimeEntry[]>(`${environment.apiUrl}/time-tracking/entries`, {
      params: { jobId: jobId.toString() },
    });
  }

  // Job Parts
  getJobParts(jobId: number): Observable<JobPart[]> {
    return this.http.get<JobPart[]>(`${environment.apiUrl}/jobs/${jobId}/parts`);
  }

  addJobPart(jobId: number, partId: number, quantity: number = 1, notes?: string): Observable<JobPart> {
    return this.http.post<JobPart>(`${environment.apiUrl}/jobs/${jobId}/parts`, { partId, quantity, notes });
  }

  updateJobPart(jobId: number, jobPartId: number, quantity: number, notes: string | null): Observable<JobPart> {
    return this.http.patch<JobPart>(`${environment.apiUrl}/jobs/${jobId}/parts/${jobPartId}`, { quantity, notes });
  }

  removeJobPart(jobId: number, jobPartId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/jobs/${jobId}/parts/${jobPartId}`);
  }

  searchParts(search: string): Observable<PartSearchResult[]> {
    return this.http.get<PartSearchResult[]>(
      `${environment.apiUrl}/parts`, { params: { search } }
    );
  }

  // Custom field values
  getCustomFieldValues(jobId: number): Observable<CustomFieldValues> {
    return this.http.get<CustomFieldValues>(`${environment.apiUrl}/jobs/${jobId}/custom-fields`);
  }

  updateCustomFieldValues(jobId: number, values: CustomFieldValues): Observable<CustomFieldValues> {
    return this.http.put<CustomFieldValues>(
      `${environment.apiUrl}/jobs/${jobId}/custom-fields`,
      { values });
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

  disposeJob(jobId: number, request: DisposeJobRequest): Observable<JobDetail> {
    return this.http.post<JobDetail>(`${environment.apiUrl}/jobs/${jobId}/dispose`, request);
  }

  handoffToProduction(jobId: number): Observable<{ jobId: number }> {
    return this.http.post<{ jobId: number }>(`${environment.apiUrl}/jobs/${jobId}/handoff-to-production`, {});
  }

  getChildJobs(jobId: number): Observable<ChildJob[]> {
    return this.http.get<ChildJob[]>(`${environment.apiUrl}/jobs/${jobId}/child-jobs`);
  }

  explodeBom(jobId: number): Observable<BomExplosionResponse> {
    return this.http.post<BomExplosionResponse>(`${environment.apiUrl}/jobs/${jobId}/explode-bom`, {});
  }

  getInternalProjectTypes(): Observable<{ id: number; code: string; label: string }[]> {
    return this.http.get<{ id: number; code: string; label: string }[]>(`${environment.apiUrl}/jobs/internal-project-types`);
  }

  setCoverPhoto(jobId: number, fileAttachmentId: number | null): Observable<void> {
    return this.http.patch<void>(`${environment.apiUrl}/jobs/${jobId}/cover-photo`, { fileAttachmentId });
  }

  // Notes
  getNotes(jobId: number): Observable<JobNote[]> {
    return this.http.get<JobNote[]>(`${environment.apiUrl}/jobs/${jobId}/notes`);
  }

  createNote(jobId: number, text: string, mentionedUserIds: number[] = []): Observable<JobNote> {
    return this.http.post<JobNote>(`${environment.apiUrl}/jobs/${jobId}/notes`, { text, mentionedUserIds });
  }

  deleteNote(jobId: number, noteId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/jobs/${jobId}/notes/${noteId}`);
  }

  // History
  getHistory(jobId: number): Observable<ActivityItem[]> {
    return this.http.get<ActivityItem[]>(`${environment.apiUrl}/jobs/${jobId}/history`);
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
