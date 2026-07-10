import { Injectable, effect, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../shared/services/auth.service';
import { TrainingModuleListItem, TrainingModuleDetail } from '../models/training-module.model';
import { TrainingPath } from '../models/training-path.model';
import { TrainingProgress, TrainingEnrollment } from '../models/training-progress.model';
import { QuizAnswer, QuizSubmissionResult } from '../models/quiz-content.model';
import { UserTrainingDetail } from '../models/user-training-detail.model';
import { GenerateWalkthroughResponse, WalkthroughStep } from '../../admin/models/walkthrough-step.model';

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface TrainingModuleParams {
  search?: string;
  contentType?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class TrainingService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = `${environment.apiUrl}/training`;

  /**
   * Completions that couldn't be recorded when they happened — e.g. a
   * walkthrough that ends on the shop floor, where the kiosk flow has
   * already cleared the session (ephemeralLogout) so the complete POST
   * would 401 and the progress silently vanish. They're stashed here and
   * replayed on the next authenticated session.
   */
  private static readonly PENDING_COMPLETIONS_KEY = 'training:pending-completions';

  constructor() {
    effect(() => {
      if (this.auth.user()) this.flushPendingCompletions();
    });
  }

  /** Stash a completion to be replayed once a session exists again. */
  queueCompletion(moduleId: number): void {
    const pending = this.readPending();
    if (!pending.includes(moduleId)) pending.push(moduleId);
    localStorage.setItem(TrainingService.PENDING_COMPLETIONS_KEY, JSON.stringify(pending));
  }

  private flushPendingCompletions(): void {
    for (const moduleId of this.readPending()) {
      this.completeModule(moduleId).subscribe({
        next: () => this.removePending(moduleId),
        // Keep it queued on failure — retried on the next login.
        error: () => {},
      });
    }
  }

  private readPending(): number[] {
    try {
      const raw = localStorage.getItem(TrainingService.PENDING_COMPLETIONS_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((v): v is number => typeof v === 'number') : [];
    } catch {
      return [];
    }
  }

  private removePending(moduleId: number): void {
    const rest = this.readPending().filter(id => id !== moduleId);
    if (rest.length === 0) localStorage.removeItem(TrainingService.PENDING_COMPLETIONS_KEY);
    else localStorage.setItem(TrainingService.PENDING_COMPLETIONS_KEY, JSON.stringify(rest));
  }

  getModules(params: TrainingModuleParams = {}): Observable<PaginatedResult<TrainingModuleListItem>> {
    let httpParams = new HttpParams();
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.contentType) httpParams = httpParams.set('contentType', params.contentType);
    if (params.tag) httpParams = httpParams.set('tag', params.tag);
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.pageSize) httpParams = httpParams.set('pageSize', params.pageSize.toString());
    return this.http.get<PaginatedResult<TrainingModuleListItem>>(`${this.base}/modules`, { params: httpParams });
  }

  getModule(id: number): Observable<TrainingModuleDetail> {
    return this.http.get<TrainingModuleDetail>(`${this.base}/modules/${id}`);
  }

  getModulesByRoute(route: string): Observable<TrainingModuleListItem[]> {
    return this.http.get<TrainingModuleListItem[]>(`${this.base}/modules/by-route`, {
      params: new HttpParams().set('route', route),
    });
  }

  getPaths(): Observable<TrainingPath[]> {
    return this.http.get<TrainingPath[]>(`${this.base}/paths`);
  }

  getPath(id: number): Observable<TrainingPath> {
    return this.http.get<TrainingPath>(`${this.base}/paths/${id}`);
  }

  getMyEnrollments(): Observable<TrainingEnrollment[]> {
    return this.http.get<TrainingEnrollment[]>(`${this.base}/my-enrollments`);
  }

  getMyProgress(): Observable<TrainingProgress[]> {
    return this.http.get<TrainingProgress[]>(`${this.base}/my-progress`);
  }

  recordStart(moduleId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/progress/${moduleId}/start`, {});
  }

  recordHeartbeat(moduleId: number, seconds: number): Observable<void> {
    return this.http.post<void>(`${this.base}/progress/${moduleId}/heartbeat`, { seconds });
  }

  completeModule(moduleId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/progress/${moduleId}/complete`, {});
  }

  submitQuiz(moduleId: number, answers: QuizAnswer[]): Observable<QuizSubmissionResult> {
    return this.http.post<QuizSubmissionResult>(`${this.base}/progress/${moduleId}/submit-quiz`, { answers });
  }

  // Admin
  createModule(data: Partial<TrainingModuleDetail>): Observable<TrainingModuleDetail> {
    return this.http.post<TrainingModuleDetail>(`${this.base}/modules`, data);
  }

  updateModule(id: number, data: Partial<TrainingModuleDetail>): Observable<TrainingModuleDetail> {
    return this.http.put<TrainingModuleDetail>(`${this.base}/modules/${id}`, data);
  }

  deleteModule(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/modules/${id}`);
  }

  createPath(data: Partial<TrainingPath>): Observable<TrainingPath> {
    return this.http.post<TrainingPath>(`${this.base}/paths`, data);
  }

  updatePath(id: number, data: Partial<TrainingPath>): Observable<TrainingPath> {
    return this.http.put<TrainingPath>(`${this.base}/paths/${id}`, data);
  }

  // Walkthrough AI generation
  generateWalkthrough(moduleId: number): Observable<GenerateWalkthroughResponse> {
    return this.http.post<GenerateWalkthroughResponse>(
      `${this.base}/modules/${moduleId}/generate-walkthrough`, {}
    );
  }

  saveWalkthroughSteps(moduleId: number, steps: WalkthroughStep[]): Observable<TrainingModuleDetail> {
    return this.http.patch<TrainingModuleDetail>(
      `${this.base}/modules/${moduleId}/walkthrough-steps`,
      { steps }
    );
  }

  getUserTrainingDetail(userId: number): Observable<UserTrainingDetail> {
    return this.http.get<UserTrainingDetail>(`${this.base}/admin/users/${userId}/detail`);
  }

}
