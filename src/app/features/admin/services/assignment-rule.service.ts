import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  AssignmentRule,
  CreateAssignmentRuleRequest,
  UpdateAssignmentRuleRequest,
} from '../models/assignment-rule.model';

@Injectable({ providedIn: 'root' })
export class AssignmentRuleService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/assignment-rules`;

  list(activeOnly?: boolean): Observable<AssignmentRule[]> {
    const params: Record<string, string> = {};
    if (activeOnly !== undefined) params['activeOnly'] = String(activeOnly);
    return this.http.get<AssignmentRule[]>(this.base, { params });
  }

  create(request: CreateAssignmentRuleRequest): Observable<AssignmentRule> {
    return this.http.post<AssignmentRule>(this.base, request);
  }

  update(id: number, request: UpdateAssignmentRuleRequest): Observable<AssignmentRule> {
    return this.http.put<AssignmentRule>(`${this.base}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
