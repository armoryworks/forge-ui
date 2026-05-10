import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  CreateOutreachCampaignRequest,
  OutreachCampaign,
  UpdateOutreachCampaignRequest,
} from '../models/campaign.model';

@Injectable({ providedIn: 'root' })
export class OutreachCampaignsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/outreach-campaigns`;

  list(activeOnly?: boolean): Observable<OutreachCampaign[]> {
    const params: Record<string, string> = {};
    if (activeOnly !== undefined) params['activeOnly'] = String(activeOnly);
    return this.http.get<OutreachCampaign[]>(this.base, { params });
  }

  create(request: CreateOutreachCampaignRequest): Observable<OutreachCampaign> {
    return this.http.post<OutreachCampaign>(this.base, request);
  }

  update(id: number, request: UpdateOutreachCampaignRequest): Observable<OutreachCampaign> {
    return this.http.put<OutreachCampaign>(`${this.base}/${id}`, request);
  }
}
