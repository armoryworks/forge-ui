import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { TrainingModuleListItem, TrainingModuleDetail, VideoStatusResponse } from '../models/training-module.model';
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
  private readonly base = `${environment.apiUrl}/training`;

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

  // AI video generation
  generateVideo(moduleId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/modules/${moduleId}/generate-video`, {});
  }

  getVideoStatus(moduleId: number): Observable<VideoStatusResponse> {
    return this.http.get<VideoStatusResponse>(`${this.base}/modules/${moduleId}/video-status`);
  }
}
