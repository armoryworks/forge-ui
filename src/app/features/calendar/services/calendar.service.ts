import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { PagedResponse } from '../../../shared/models/paged-response.model';
import { CalendarJob } from '../models/calendar-job.model';
import { PoCalendarEvent } from '../models/po-calendar-event.model';
import { CalendarSuperGroup } from '../models/calendar-super-group.model';
import { CalendarEvent } from '../models/calendar-event.model';
import { CalendarSavedView } from '../models/calendar-saved-view.model';

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly http = inject(HttpClient);

  getJobs(): Observable<CalendarJob[]> {
    // Phase 3 F7-broad / WU-22 — server now returns the paged envelope on
    // /jobs. Calendar wants the full set so we request the server cap (200)
    // and unwrap.
    return this.http.get<PagedResponse<CalendarJob>>(`${environment.apiUrl}/jobs`, {
      params: { isArchived: 'false', pageSize: '200' },
    }).pipe(map(p => p.items));
  }

  getPoEvents(from: string, to: string): Observable<PoCalendarEvent[]> {
    return this.http.get<PoCalendarEvent[]>(`${environment.apiUrl}/purchase-orders/calendar`, {
      params: { from, to },
    });
  }

  /** compliance-calendar A-3: overlay layer list — Super-Groups (with Event-Types) the user may see. */
  getSuperGroups(): Observable<CalendarSuperGroup[]> {
    return this.http.get<CalendarSuperGroup[]>(`${environment.apiUrl}/calendar/super-groups`);
  }

  /** compliance-calendar A-3: calendar events in a date window (already visibility-filtered server-side). */
  getEvents(from: string, to: string): Observable<CalendarEvent[]> {
    return this.http.get<CalendarEvent[]>(`${environment.apiUrl}/events`, {
      params: { from, to },
    });
  }

  /** compliance-calendar A-3: the current user's saved views (personal + role-default). */
  getSavedViews(scope?: string): Observable<CalendarSavedView[]> {
    return this.http.get<CalendarSavedView[]>(`${environment.apiUrl}/calendar/saved-views`, {
      params: scope ? { scope } : {},
    });
  }

  /** compliance-calendar A-3: save the current layer selection as a personal view. */
  createSavedView(body: {
    name: string;
    scope: string;
    selectedSuperGroupIds: number[];
    selectedEventTypeIds: number[];
  }): Observable<CalendarSavedView> {
    return this.http.post<CalendarSavedView>(`${environment.apiUrl}/calendar/saved-views`, body);
  }

  /** compliance-calendar A-3: delete one of the current user's saved views. */
  deleteSavedView(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/calendar/saved-views/${id}`);
  }
}
