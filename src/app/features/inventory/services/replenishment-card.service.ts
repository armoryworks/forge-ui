import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { KanbanCardStatus } from '../models/kanban-card-status.type';
import { PagedReplenishmentCards } from '../models/paged-replenishment-cards.model';
import { ReplenishmentCard } from '../models/replenishment-card.model';
import { ReplenishmentCardDetail } from '../models/replenishment-card-detail.model';
import { ReplenishmentCardRequest } from '../models/replenishment-card-request.model';

@Injectable({ providedIn: 'root' })
export class ReplenishmentCardService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/kanban-cards`;

  getCards(status?: KanbanCardStatus | null, page = 1, pageSize = 100): Observable<PagedReplenishmentCards> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (status) params = params.set('status', status);
    return this.http.get<PagedReplenishmentCards>(this.base, { params });
  }

  getCard(id: number): Observable<ReplenishmentCardDetail> {
    return this.http.get<ReplenishmentCardDetail>(`${this.base}/${id}`);
  }

  create(request: ReplenishmentCardRequest): Observable<ReplenishmentCard> {
    return this.http.post<ReplenishmentCard>(this.base, request);
  }

  update(id: number, request: ReplenishmentCardRequest): Observable<ReplenishmentCard> {
    return this.http.put<ReplenishmentCard>(`${this.base}/${id}`, request);
  }

  trigger(id: number, triggerType: 'Manual' | 'Scan' = 'Manual'): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/trigger`, { triggerType });
  }

  confirm(id: number, fulfilledQuantity: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/confirm`, { fulfilledQuantity });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
