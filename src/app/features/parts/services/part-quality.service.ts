import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { PartQualitySummary } from '../models/part-quality-summary.model';

@Injectable({ providedIn: 'root' })
export class PartQualityService {
  private readonly http = inject(HttpClient);

  getSummary(partId: number): Observable<PartQualitySummary> {
    return this.http.get<PartQualitySummary>(`${environment.apiUrl}/parts/${partId}/quality-summary`);
  }
}
