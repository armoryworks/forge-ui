import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AppEvent, EventRequest } from '../models/event.model';

@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/events`;

  getEvents(from?: string, to?: string, eventType?: string): Observable<AppEvent[]> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    if (eventType) params = params.set('eventType', eventType);
    return this.http.get<AppEvent[]>(this.base, { params });
  }

  getEvent(id: number): Observable<AppEvent> {
    return this.http.get<AppEvent>(`${this.base}/${id}`);
  }

  createEvent(request: EventRequest): Observable<AppEvent> {
    return this.http.post<AppEvent>(this.base, request);
  }

  updateEvent(id: number, request: EventRequest): Observable<AppEvent> {
    return this.http.put<AppEvent>(`${this.base}/${id}`, request);
  }

  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  respondToEvent(id: number, status: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/respond`, { status });
  }

  getUpcomingEvents(): Observable<AppEvent[]> {
    return this.http.get<AppEvent[]>(`${this.base}/upcoming`);
  }

  getUpcomingEventsForUser(userId: number): Observable<AppEvent[]> {
    return this.http.get<AppEvent[]>(`${this.base}/upcoming/${userId}`);
  }
}
