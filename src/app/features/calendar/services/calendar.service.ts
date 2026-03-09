import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CalendarJob } from '../models/calendar-job.model';

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly http = inject(HttpClient);

  getJobs(): Observable<CalendarJob[]> {
    return this.http.get<CalendarJob[]>(`${environment.apiUrl}/jobs`, {
      params: { isArchived: 'false' },
    });
  }
}
