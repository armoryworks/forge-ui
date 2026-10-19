import { Injectable, effect, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { EMPTY, Observable, catchError, defer, expand, map, of, reduce, throwError } from 'rxjs';

import { TranslateService } from '@ngx-translate/core';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../shared/services/auth.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { SILENT_HTTP_ERRORS } from '../../../shared/interceptors/silent-http-errors.token';
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

export type CompletionOutcome = 'completed' | 'queued';

interface PendingCompletion {
  userId: number;
  moduleId: number;
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

  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  /**
   * Completions that couldn't be recorded when they happened — e.g. a
   * walkthrough that ends on the shop floor, where the kiosk flow has
   * already cleared the session (ephemeralLogout) so the complete POST
   * would 401 and the progress silently vanish. Each entry carries the user
   * who earned it and is replayed only in that user's next session.
   */
  private static readonly PENDING_COMPLETIONS_KEY = 'training:pending-completions';

  private static readonly PAGE_SIZE_MAX = 100;

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (user) this.flushPendingCompletions(user.id);
    });
  }

  /**
   * Record a completion for the user who earned it: `earnedBy` when given (captured when a
   * walkthrough starts, before a kiosk flow can clear the session), otherwise the signed-in
   * user. When that user is no longer the one signed in, the request cannot reach the server,
   * or the session has lapsed, the completion is queued for that user and replayed on their
   * next session; any other failure is passed on.
   */
  completeOrQueue(moduleId: number, earnedBy?: number): Observable<CompletionOutcome> {
    const userId = earnedBy ?? this.auth.user()?.id;
    if (userId == null) return throwError(() => new Error('No user to credit the completion to.'));
    if (this.auth.user()?.id !== userId) return defer(() => of(this.queueAndNotify(userId, moduleId)));
    return this.completeModule(moduleId).pipe(
      map((): CompletionOutcome => 'completed'),
      catchError((error: unknown) => TrainingService.isRetryable(error)
        ? of(this.queueAndNotify(userId, moduleId))
        : throwError(() => error)),
    );
  }

  private queueAndNotify(userId: number, moduleId: number): CompletionOutcome {
    this.queueCompletion(userId, moduleId);
    this.snackbar.info(this.translate.instant('training.completionQueued'));
    return 'queued';
  }

  private queueCompletion(userId: number, moduleId: number): void {
    const pending = this.readPending();
    if (!pending.some(p => p.userId === userId && p.moduleId === moduleId)) pending.push({ userId, moduleId });
    this.writePending(pending);
  }

  private flushPendingCompletions(userId: number): void {
    for (const { moduleId } of this.readPending().filter(p => p.userId === userId)) {
      this.completeModule(moduleId, new HttpContext().set(SILENT_HTTP_ERRORS, true)).subscribe({
        next: () => this.removePending(userId, moduleId),
        error: (error: unknown) => {
          if (!TrainingService.isRetryable(error)) this.removePending(userId, moduleId);
        },
      });
    }
  }

  private static isRetryable(error: unknown): boolean {
    return error instanceof HttpErrorResponse && (error.status === 0 || error.status === 401);
  }

  private readPending(): PendingCompletion[] {
    try {
      const raw = localStorage.getItem(TrainingService.PENDING_COMPLETIONS_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(TrainingService.isPendingCompletion) : [];
    } catch {
      return [];
    }
  }

  private static isPendingCompletion(value: unknown): value is PendingCompletion {
    if (typeof value !== 'object' || value === null) return false;
    const entry = value as Partial<PendingCompletion>;
    return typeof entry.userId === 'number' && typeof entry.moduleId === 'number';
  }

  private writePending(pending: PendingCompletion[]): void {
    try {
      if (pending.length === 0) localStorage.removeItem(TrainingService.PENDING_COMPLETIONS_KEY);
      else localStorage.setItem(TrainingService.PENDING_COMPLETIONS_KEY, JSON.stringify(pending));
    } catch {
      return;
    }
  }

  private removePending(userId: number, moduleId: number): void {
    this.writePending(this.readPending().filter(p => !(p.userId === userId && p.moduleId === moduleId)));
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

  /** Every module matching the filters, fetched page by page at the server's page-size cap. */
  getAllModules(params: Omit<TrainingModuleParams, 'page' | 'pageSize'> = {}): Observable<TrainingModuleListItem[]> {
    const pageSize = TrainingService.PAGE_SIZE_MAX;
    return this.getModules({ ...params, page: 1, pageSize }).pipe(
      expand(result => result.page < result.totalPages
        ? this.getModules({ ...params, page: result.page + 1, pageSize })
        : EMPTY),
      reduce((all, result) => all.concat(result.data), [] as TrainingModuleListItem[]),
    );
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

  completeModule(moduleId: number, context?: HttpContext): Observable<void> {
    return this.http.post<void>(`${this.base}/progress/${moduleId}/complete`, {}, { context });
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
