import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { TrainingPathEnrollment } from '../models/training-path-enrollment.model';
import { EnrollInPathRequest } from '../models/enroll-in-path-request.model';
import { EnrollInPathResult } from '../models/enroll-in-path-result.model';

/** Admin enrolment of people and roles into training paths, with due dates and per-enrolment progress. */
@Injectable({ providedIn: 'root' })
export class TrainingEnrollmentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/training`;

  getPathEnrollments(pathId: number): Observable<TrainingPathEnrollment[]> {
    return this.http.get<TrainingPathEnrollment[]>(`${this.base}/paths/${pathId}/enrollments`);
  }

  enroll(pathId: number, request: EnrollInPathRequest): Observable<EnrollInPathResult> {
    return this.http.post<EnrollInPathResult>(`${this.base}/paths/${pathId}/enrollments`, request);
  }

  setDueDate(enrollmentId: number, dueDate: string | null): Observable<void> {
    return this.http.patch<void>(`${this.base}/enrollments/${enrollmentId}`, { dueDate });
  }

  remove(enrollmentId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/enrollments/${enrollmentId}`);
  }
}
