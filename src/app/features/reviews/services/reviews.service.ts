import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PerformanceReview } from '../models/performance-review.model';
import { PerformanceReviewDetail } from '../models/performance-review-detail.model';
import { ReviewCycle } from '../models/review-cycle.model';
import { SaveReviewCycleRequest } from '../models/save-review-cycle-request.model';
import { LaunchReviewCycleResult } from '../models/launch-review-cycle-result.model';
import { SubmitSelfReviewRequest } from '../models/submit-self-review-request.model';
import { SubmitManagerReviewRequest } from '../models/submit-manager-review-request.model';

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/reviews`;

  getCycles(): Observable<ReviewCycle[]> {
    return this.http.get<ReviewCycle[]>(`${this.base}/cycles`);
  }

  createCycle(request: SaveReviewCycleRequest): Observable<ReviewCycle> {
    return this.http.post<ReviewCycle>(`${this.base}/cycles`, request);
  }

  updateCycle(id: number, request: SaveReviewCycleRequest): Observable<ReviewCycle> {
    return this.http.put<ReviewCycle>(`${this.base}/cycles/${id}`, request);
  }

  launchCycle(id: number): Observable<LaunchReviewCycleResult> {
    return this.http.post<LaunchReviewCycleResult>(`${this.base}/cycles/${id}/launch`, {});
  }

  closeCycle(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/cycles/${id}/close`, {});
  }

  getMine(): Observable<PerformanceReview[]> {
    return this.http.get<PerformanceReview[]>(`${this.base}/mine`);
  }

  getTeam(): Observable<PerformanceReview[]> {
    return this.http.get<PerformanceReview[]>(`${this.base}/team`);
  }

  getCycleReviews(cycleId: number): Observable<PerformanceReview[]> {
    return this.http.get<PerformanceReview[]>(this.base, { params: { cycleId } });
  }

  getReview(id: number): Observable<PerformanceReviewDetail> {
    return this.http.get<PerformanceReviewDetail>(`${this.base}/${id}`);
  }

  submitSelf(id: number, request: SubmitSelfReviewRequest): Observable<PerformanceReview> {
    return this.http.post<PerformanceReview>(`${this.base}/${id}/self-submit`, request);
  }

  submitManager(id: number, request: SubmitManagerReviewRequest): Observable<PerformanceReview> {
    return this.http.post<PerformanceReview>(`${this.base}/${id}/manager-submit`, request);
  }

  acknowledge(id: number, comments: string | null): Observable<PerformanceReview> {
    return this.http.post<PerformanceReview>(`${this.base}/${id}/acknowledge`, { comments });
  }

  close(id: number): Observable<PerformanceReview> {
    return this.http.post<PerformanceReview>(`${this.base}/${id}/close`, {});
  }
}
