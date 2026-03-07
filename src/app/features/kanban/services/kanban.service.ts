import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TrackType, KanbanJob, BoardColumn } from '../models/kanban.model';
import { MOCK_TRACK_TYPES, MOCK_JOBS } from './kanban-mock.data';

@Injectable({ providedIn: 'root' })
export class KanbanService {
  private readonly http = inject(HttpClient);

  getTrackTypes(): Observable<TrackType[]> {
    if (environment.mockIntegrations) {
      return of(MOCK_TRACK_TYPES);
    }
    return this.http.get<TrackType[]>(`${environment.apiUrl}/track-types`);
  }

  getBoard(trackTypeId: number): Observable<BoardColumn[]> {
    if (environment.mockIntegrations) {
      const trackType = MOCK_TRACK_TYPES.find(t => t.id === trackTypeId)!;
      const jobs = MOCK_JOBS.filter(j => {
        return trackType.stages.some(s => s.name === j.stageName);
      });
      return of(this.buildBoard(trackType, jobs));
    }
    return forkJoin({
      trackType: this.http.get<TrackType>(`${environment.apiUrl}/track-types/${trackTypeId}`),
      jobs: this.http.get<KanbanJob[]>(`${environment.apiUrl}/jobs`, {
        params: { trackTypeId: trackTypeId.toString(), isArchived: 'false' },
      }),
    }).pipe(map(({ trackType, jobs }) => this.buildBoard(trackType, jobs)));
  }

  moveJobStage(jobId: number, stageId: number): Observable<unknown> {
    if (environment.mockIntegrations) {
      return of(null);
    }
    return this.http.patch(`${environment.apiUrl}/jobs/${jobId}/stage`, { stageId });
  }

  updateJobPosition(jobId: number, position: number): Observable<void> {
    if (environment.mockIntegrations) {
      return of(undefined);
    }
    return this.http.patch<void>(`${environment.apiUrl}/jobs/${jobId}/position`, { position });
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
