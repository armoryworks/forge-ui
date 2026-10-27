import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Recall } from '../models/recall.model';
import { RecallDetail } from '../models/recall-detail.model';
import { RecallStatus } from '../models/recall-status.model';
import { InitiateRecallRequest } from '../models/initiate-recall-request.model';
import { RecallImpactPreview } from '../models/recall-impact-preview.model';

@Injectable({ providedIn: 'root' })
export class RecallService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/recalls`;

  getRecalls(status?: RecallStatus): Observable<Recall[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<Recall[]>(this.base, { params });
  }

  getRecall(id: number): Observable<RecallDetail> {
    return this.http.get<RecallDetail>(`${this.base}/${id}`);
  }

  previewRecall(recalledLotId: number): Observable<RecallImpactPreview> {
    return this.http.post<RecallImpactPreview>(`${this.base}/preview`, { recalledLotId });
  }

  initiateRecall(request: InitiateRecallRequest): Observable<RecallDetail> {
    return this.http.post<RecallDetail>(this.base, request);
  }

  resolveRecall(id: number, resolutionNotes: string | null, releaseHeldStock = false): Observable<RecallDetail> {
    return this.http.post<RecallDetail>(`${this.base}/${id}/resolve`, { resolutionNotes, releaseHeldStock });
  }
}
