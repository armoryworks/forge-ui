import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { TrackTypeStageAdmin } from '../models/track-type-stage-admin.model';

@Injectable({ providedIn: 'root' })
export class TrackTypeStagesService {
  private readonly http = inject(HttpClient);

  getStages(trackTypeId: number): Observable<TrackTypeStageAdmin[]> {
    return this.http.get<TrackTypeStageAdmin[]>(`${environment.apiUrl}/admin/track-types/${trackTypeId}/stages`);
  }
}
