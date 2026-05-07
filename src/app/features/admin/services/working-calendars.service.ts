import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  CalendarShift,
  CalendarShiftRequest,
  Holiday,
  HolidayRequest,
  WorkingCalendar,
  WorkingCalendarRequest,
} from '../models/working-calendar.model';

@Injectable({ providedIn: 'root' })
export class WorkingCalendarsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/working-calendars`;

  list(): Observable<WorkingCalendar[]> {
    return this.http.get<WorkingCalendar[]>(this.base);
  }

  get(id: number): Observable<WorkingCalendar> {
    return this.http.get<WorkingCalendar>(`${this.base}/${id}`);
  }

  create(request: WorkingCalendarRequest): Observable<WorkingCalendar> {
    return this.http.post<WorkingCalendar>(this.base, request);
  }

  update(id: number, request: WorkingCalendarRequest): Observable<WorkingCalendar> {
    return this.http.put<WorkingCalendar>(`${this.base}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  setDefault(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/set-default`, null);
  }

  addHoliday(calendarId: number, request: HolidayRequest): Observable<Holiday> {
    return this.http.post<Holiday>(`${this.base}/${calendarId}/holidays`, request);
  }

  deleteHoliday(calendarId: number, holidayId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${calendarId}/holidays/${holidayId}`);
  }

  // Shifts effort — calendar-bound shift CRUD. Read path is via get(id);
  // the calendar response embeds the shifts list + computed weekly capacity.
  addShift(calendarId: number, request: CalendarShiftRequest): Observable<CalendarShift> {
    return this.http.post<CalendarShift>(`${this.base}/${calendarId}/shifts`, request);
  }

  updateShift(calendarId: number, shiftId: number, request: CalendarShiftRequest): Observable<CalendarShift> {
    return this.http.put<CalendarShift>(`${this.base}/${calendarId}/shifts/${shiftId}`, request);
  }

  deleteShift(calendarId: number, shiftId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${calendarId}/shifts/${shiftId}`);
  }
}
