import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AndonAlert } from '../models/andon-alert.model';

@Injectable({ providedIn: 'root' })
export class AndonService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/shop-floor/andon`;

  getOpenAlerts(kiosk = false): Observable<AndonAlert[]> {
    return kiosk
      ? this.http.get<AndonAlert[]>(`${environment.apiUrl}/display/shop-floor/andon/alerts`)
      : this.http.get<AndonAlert[]>(`${this.base}/alerts`, { params: new HttpParams().set('openOnly', true) });
  }

  acknowledge(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/alerts/${id}/acknowledge`, {});
  }

  resolve(id: number, notes: string | null): Observable<void> {
    return this.http.post<void>(`${this.base}/alerts/${id}/resolve`, { notes });
  }
}
