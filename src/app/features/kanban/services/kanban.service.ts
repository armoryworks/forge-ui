import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, forkJoin, of, switchMap } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PagedResponse } from '../../../shared/models/paged-response.model';
import { TrackType } from '../../../shared/models/track-type.model';
import { TeamRef } from '../../../shared/models/team-ref.model';
import { ActivityItem } from '../../../shared/models/activity.model';
import { KanbanJob } from '../models/kanban-job.model';
import { BoardColumn } from '../models/board-column.model';
import { KanbanBoard } from '../models/kanban-board.model';
import { BoardFilters } from '../models/board-filters.model';
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
import { AssignableSalesOrderLine } from '../models/assignable-sales-order-line.model';
import { CustomFieldValues } from '../models/custom-field-values.model';
import { DisposeJobRequest } from '../models/dispose-job-request.model';
import { JobDispositionStock } from '../models/job-disposition-stock.model';
import { ChildJob } from '../models/child-job.model';
import { BomExplosionResponse } from '../models/bom-explosion-response.model';
import { JobBomAtRelease } from '../../parts/models/bom-revision.model';

const BOARD_PAGE_SIZE = 200;
const BOARD_MAX_ROWS = 2000;

@Injectable({ providedIn: 'root' })
export class KanbanService {
  private readonly http = inject(HttpClient);

  getTrackTypes(): Observable<TrackType[]> {
    return this.http.get<TrackType[]>(`${environment.apiUrl}/track-types`);
  }

  getBoard(trackTypeId: number, filters: Partial<BoardFilters> = {}): Observable<KanbanBoard> {
    return forkJoin({
      trackType: this.http.get<TrackType>(`${environment.apiUrl}/track-types/${trackTypeId}`),
      page: this.getBoardJobs(this.boardParams(trackTypeId, filters)),
    }).pipe(map(({ trackType, page }) => {
      const jobs = page.items.map(j => ({
        ...j,
        boardPosition: j.boardPosition ?? 0,
        partNumber: j.partNumber ?? null,
        quantity: j.quantity ?? null,
      }));
      return {
        columns: this.buildBoard(trackType, jobs),
        totalCount: Math.max(page.totalCount ?? jobs.length, jobs.length),
        loadedCount: jobs.length,
      };
    }));
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

  /** Phase 3 H4 / WU-20 — what BOM revision was the job released against? */
  getJobBomAtRelease(jobId: number): Observable<JobBomAtRelease> {
    return this.http.get<JobBomAtRelease>(`${environment.apiUrl}/jobs/${jobId}/bom-at-release`);
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

  getTeams(): Observable<TeamRef[]> {
    return this.http.get<TeamRef[]>(`${environment.apiUrl}/display/shop-floor/teams`);
  }

  getUsers(): Observable<UserRef[]> {
    return this.http.get<UserRef[]>(`${environment.apiUrl}/users`);
  }

  createJob(command: {
    jobNumber?: string;
    title: string;
    description?: string;
    trackTypeId: number;
    assigneeId?: number | null;
    customerId?: number | null;
    priority?: string;
    dueDate?: string | null;
    salesOrderLineId?: number | null;
    partId?: number | null;
    quantity?: number | null;
    initialStageId?: number | null;
  }): Observable<JobDetail> {
    return this.http.post<JobDetail>(`${environment.apiUrl}/jobs`, command);
  }

  /**
   * #27 — sales-order lines available to associate with a new job. Defaults to lines
   * not actively assigned to an open job; pass includeAssigned=true to show the rest.
   */
  getAssignableSalesOrderLines(includeAssigned = false, search?: string): Observable<AssignableSalesOrderLine[]> {
    let params = new HttpParams().set('includeAssigned', String(includeAssigned));
    if (search) params = params.set('search', search);
    return this.http.get<AssignableSalesOrderLine[]>(
      `${environment.apiUrl}/orders/assignable-lines`, { params });
  }

  updateJob(id: number, changes: Partial<Omit<JobDetail, 'dueDate'>> & { dueDate?: Date | string | null }): Observable<unknown> {
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
    // WU-22 — /parts returns the standard paged envelope ({ items, totalCount,
    // page, pageSize }); unwrap to the flat array the part typeahead expects.
    // Without this the component's results.filter(...) ran on the envelope object,
    // threw, and the (error-handler-less) subscription died silently — the search
    // showed nothing (issue #28). The legacy ?search= alias still works server-side.
    return this.http.get<PagedResponse<PartSearchResult>>(
      `${environment.apiUrl}/parts`, { params: { search } }
    ).pipe(map(p => p.items));
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
    // Phase 3 F7-broad / WU-22 — unwrap the paged envelope. The legacy
    // ?search= alias still works server-side.
    return this.http.get<PagedResponse<KanbanJob>>(`${environment.apiUrl}/jobs`, {
      params: { search, isArchived: 'false', pageSize: '50' },
    }).pipe(map(p => p.items));
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

  /** Inverse of {@link bulkArchive}. Admin-only on the server. Phase 3 / WU-07 / F2. */
  bulkUnarchive(jobIds: number[]): Observable<BulkResult> {
    return this.http.patch<BulkResult>(`${environment.apiUrl}/jobs/bulk/unarchive`, { jobIds });
  }

  /** Single-job convenience over the bulk endpoint. Admin-only on the server. */
  unarchiveJob(jobId: number): Observable<BulkResult> {
    return this.http.post<BulkResult>(`${environment.apiUrl}/jobs/${jobId}/unarchive`, {});
  }

  getDispositionStock(jobId: number): Observable<JobDispositionStock> {
    return this.http.get<JobDispositionStock>(`${environment.apiUrl}/jobs/${jobId}/disposition-stock`);
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

  private boardParams(trackTypeId: number, filters: Partial<BoardFilters>): HttpParams {
    let params = new HttpParams()
      .set('trackTypeId', trackTypeId.toString())
      .set('isArchived', 'false')
      .set('pageSize', BOARD_PAGE_SIZE.toString())
      .set('sort', 'board');
    const search = filters.search?.trim();
    if (filters.teamId != null) params = params.set('teamId', filters.teamId.toString());
    if (filters.activeOnly) params = params.set('activeOnly', 'true');
    if (search) params = params.set('q', search);
    if (filters.customerId != null) params = params.set('customerId', filters.customerId.toString());
    if (filters.overdueOnly) params = params.set('overdueOnly', 'true');
    if (filters.onHoldOnly) params = params.set('onHoldOnly', 'true');
    return params;
  }

  private getBoardJobs(params: HttpParams): Observable<Pick<PagedResponse<KanbanJob>, 'items' | 'totalCount'>> {
    const fetchPage = (page: number) => this.http.get<PagedResponse<KanbanJob>>(`${environment.apiUrl}/jobs`, {
      params: params.set('page', page.toString()),
    });
    return fetchPage(1).pipe(switchMap(first => {
      const totalCount = first.totalCount ?? first.items.length;
      const pageCount = Math.ceil(Math.min(totalCount, BOARD_MAX_ROWS) / BOARD_PAGE_SIZE);
      if (pageCount <= 1 || first.items.length < BOARD_PAGE_SIZE) {
        return of({ items: first.items, totalCount });
      }
      const rest = Array.from({ length: pageCount - 1 }, (_, i) => fetchPage(i + 2));
      return forkJoin(rest).pipe(map(pages => {
        const byId = new Map<number, KanbanJob>();
        for (const job of [first, ...pages].flatMap(p => p.items)) {
          if (!byId.has(job.id)) byId.set(job.id, job);
        }
        return { items: [...byId.values()], totalCount };
      }));
    }));
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
      jobs: (jobsByStage.get(stage.name) ?? []).sort((a, b) => a.boardPosition - b.boardPosition || a.id - b.id),
    }));
  }
}
