import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { FollowUpTask } from '../models/follow-up-task.model';

@Injectable({ providedIn: 'root' })
export class FollowUpTaskService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/follow-up-tasks`;

  getTasks(status?: string): Observable<FollowUpTask[]> {
    const params: Record<string, string> = {};
    if (status) {
      params['status'] = status;
    }
    return this.http.get<FollowUpTask[]>(this.base, { params });
  }

  completeTask(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/complete`, {});
  }

  dismissTask(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/dismiss`, {});
  }
}
