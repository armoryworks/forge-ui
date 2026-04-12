import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Eco, CreateEcoRequest, UpdateEcoRequest, EcoAffectedItem, CreateEcoAffectedItemRequest, EcoStatus } from '../models/eco.model';

@Injectable({ providedIn: 'root' })
export class EcoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/quality/ecos`;

  getEcos(params?: { status?: EcoStatus }): Observable<Eco[]> {
    let httpParams = new HttpParams();
    if (params?.status) httpParams = httpParams.set('status', params.status);
    return this.http.get<Eco[]>(this.base, { params: httpParams });
  }

  getEcoById(id: number): Observable<Eco> {
    return this.http.get<Eco>(`${this.base}/${id}`);
  }

  createEco(data: CreateEcoRequest): Observable<Eco> {
    return this.http.post<Eco>(this.base, data);
  }

  updateEco(id: number, data: UpdateEcoRequest): Observable<Eco> {
    return this.http.patch<Eco>(`${this.base}/${id}`, data);
  }

  approveEco(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/approve`, {});
  }

  implementEco(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/implement`, {});
  }

  addAffectedItem(ecoId: number, data: CreateEcoAffectedItemRequest): Observable<EcoAffectedItem> {
    return this.http.post<EcoAffectedItem>(`${this.base}/${ecoId}/affected-items`, data);
  }

  deleteAffectedItem(ecoId: number, itemId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${ecoId}/affected-items/${itemId}`);
  }
}
