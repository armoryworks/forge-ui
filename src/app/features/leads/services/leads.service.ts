import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { LeadItem } from '../models/lead-item.model';
import { CreateLeadRequest } from '../models/create-lead-request.model';
import { UpdateLeadRequest } from '../models/update-lead-request.model';
import { LeadStatus } from '../models/lead-status.type';
import { ConvertLeadResult } from '../models/convert-lead-result.model';
import { ConvertLeadRequest } from '../models/convert-lead-request.model';
import { BulkLeadIntakeRequest, BulkLeadIntakeResponse } from '../models/bulk-intake.model';

@Injectable({ providedIn: 'root' })
export class LeadsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/leads`;

  getLeads(status?: LeadStatus, search?: string): Observable<LeadItem[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (search) params = params.set('search', search);
    return this.http.get<LeadItem[]>(this.base, { params });
  }

  getLeadById(id: number): Observable<LeadItem> {
    return this.http.get<LeadItem>(`${this.base}/${id}`);
  }

  createLead(request: CreateLeadRequest): Observable<LeadItem> {
    return this.http.post<LeadItem>(this.base, request);
  }

  updateLead(id: number, request: UpdateLeadRequest): Observable<LeadItem> {
    return this.http.patch<LeadItem>(`${this.base}/${id}`, request);
  }

  convertLead(id: number, request: ConvertLeadRequest): Observable<ConvertLeadResult> {
    return this.http.post<ConvertLeadResult>(`${this.base}/${id}/convert`, request);
  }

  deleteLead(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  // Phase 1r / Batch 4 — bulk intake. Preview returns per-row dedup +
  // suppression + quality status without persisting; commit re-runs the
  // pipeline AND inserts the rows that pass.

  bulkIntakePreview(request: BulkLeadIntakeRequest): Observable<BulkLeadIntakeResponse> {
    return this.http.post<BulkLeadIntakeResponse>(`${this.base}/bulk-intake/preview`, request);
  }

  bulkIntakeCommit(request: BulkLeadIntakeRequest): Observable<BulkLeadIntakeResponse> {
    return this.http.post<BulkLeadIntakeResponse>(`${this.base}/bulk-intake/commit`, request);
  }
}
