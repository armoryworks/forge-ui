import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { LeadItem, CreateLeadRequest, UpdateLeadRequest, LeadStatus } from '../models/leads.model';

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
}
