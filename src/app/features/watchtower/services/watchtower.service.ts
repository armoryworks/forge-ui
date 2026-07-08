import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { RegulatoryProposal } from '../models/regulatory-proposal.model';
import { RegulatorySource } from '../models/regulatory-source.model';
import { ApplyProposalRequest } from '../models/apply-proposal-request.model';

/** regulatory-watchtower: monitored sources + proposed regulatory changes (CAP-EXT-WATCHTOWER). */
@Injectable({ providedIn: 'root' })
export class WatchtowerService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/watchtower`;

  getProposals(status?: string): Observable<RegulatoryProposal[]> {
    return this.http.get<RegulatoryProposal[]>(`${this.base}/proposals`, status ? { params: { status } } : {});
  }

  getSources(): Observable<RegulatorySource[]> {
    return this.http.get<RegulatorySource[]>(`${this.base}/sources`);
  }

  applyProposal(id: number, request: ApplyProposalRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/proposals/${id}/apply`, request);
  }

  dismissProposal(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/proposals/${id}/dismiss`, {});
  }

  poll(): Observable<{ created: number }> {
    return this.http.post<{ created: number }>(`${this.base}/poll`, {});
  }
}
