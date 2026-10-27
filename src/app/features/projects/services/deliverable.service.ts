import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Deliverable } from '../models/deliverable.model';
import { DeliverablePage } from '../models/deliverable-page.model';
import { DeliverableRequest } from '../models/deliverable-request.model';

@Injectable({ providedIn: 'root' })
export class DeliverableService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/deliverables`;

  listForProject(projectId: number): Observable<DeliverablePage> {
    const params = new HttpParams().set('projectId', projectId).set('pageSize', 100);
    return this.http.get<DeliverablePage>(this.base, { params });
  }

  create(request: DeliverableRequest): Observable<Deliverable> {
    return this.http.post<Deliverable>(this.base, request);
  }

  update(id: number, request: DeliverableRequest): Observable<Deliverable> {
    return this.http.put<Deliverable>(`${this.base}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
