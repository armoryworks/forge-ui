import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  CreateIcpRubricRequest,
  IcpRubric,
  IcpRubricDetail,
  SaveIcpDimensionRequest,
  UpdateIcpRubricRequest,
} from '../models/icp-rubric.model';

@Injectable({ providedIn: 'root' })
export class IcpRubricService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/icp-rubrics`;

  list(activeOnly?: boolean): Observable<IcpRubric[]> {
    const params: Record<string, string> = {};
    if (activeOnly !== undefined) params['activeOnly'] = String(activeOnly);
    return this.http.get<IcpRubric[]>(this.base, { params });
  }

  getById(id: number): Observable<IcpRubricDetail> {
    return this.http.get<IcpRubricDetail>(`${this.base}/${id}`);
  }

  create(request: CreateIcpRubricRequest): Observable<IcpRubric> {
    return this.http.post<IcpRubric>(this.base, request);
  }

  update(id: number, request: UpdateIcpRubricRequest): Observable<IcpRubric> {
    return this.http.put<IcpRubric>(`${this.base}/${id}`, request);
  }

  saveDimensions(id: number, dimensions: SaveIcpDimensionRequest[]): Observable<IcpRubricDetail> {
    return this.http.post<IcpRubricDetail>(`${this.base}/${id}/dimensions`, dimensions);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
