import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AdminUser } from '../models/admin-user.model';
import { CreateUserRequest } from '../models/create-user-request.model';
import { UpdateUserRequest } from '../models/update-user-request.model';
import { CreateTrackTypeRequest } from '../models/create-track-type-request.model';
import { UpdateTrackTypeRequest } from '../models/update-track-type-request.model';
import { ReferenceDataGroup } from '../models/reference-data-group.model';
import { ReferenceDataEntry } from '../models/reference-data-entry.model';
import { TerminologyEntryItem } from '../models/terminology-entry-item.model';
import { TrackType } from '../../../shared/models/track-type.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  // Users
  getUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${environment.apiUrl}/admin/users`);
  }

  createUser(request: CreateUserRequest): Observable<AdminUser> {
    return this.http.post<AdminUser>(`${environment.apiUrl}/admin/users`, request);
  }

  updateUser(id: number, request: UpdateUserRequest): Observable<AdminUser> {
    return this.http.put<AdminUser>(`${environment.apiUrl}/admin/users/${id}`, request);
  }

  // Track Types
  getTrackTypes(): Observable<TrackType[]> {
    return this.http.get<TrackType[]>(`${environment.apiUrl}/admin/track-types`);
  }

  createTrackType(request: CreateTrackTypeRequest): Observable<TrackType> {
    return this.http.post<TrackType>(`${environment.apiUrl}/admin/track-types`, request);
  }

  updateTrackType(id: number, request: UpdateTrackTypeRequest): Observable<TrackType> {
    return this.http.put<TrackType>(`${environment.apiUrl}/admin/track-types/${id}`, request);
  }

  deleteTrackType(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/admin/track-types/${id}`);
  }

  // Reference Data
  getReferenceData(): Observable<ReferenceDataGroup[]> {
    return this.http.get<ReferenceDataGroup[]>(`${environment.apiUrl}/admin/reference-data`);
  }

  createReferenceData(request: { groupCode: string; code: string; label: string; sortOrder: number; metadata?: string }): Observable<ReferenceDataEntry> {
    return this.http.post<ReferenceDataEntry>(`${environment.apiUrl}/admin/reference-data`, request);
  }

  updateReferenceData(id: number, request: { label?: string; sortOrder?: number; isActive?: boolean; metadata?: string }): Observable<ReferenceDataEntry> {
    return this.http.put<ReferenceDataEntry>(`${environment.apiUrl}/admin/reference-data/${id}`, request);
  }

  // Terminology
  getTerminology(): Observable<TerminologyEntryItem[]> {
    return this.http.get<TerminologyEntryItem[]>(`${environment.apiUrl}/terminology`);
  }

  updateTerminology(entries: TerminologyEntryItem[]): Observable<TerminologyEntryItem[]> {
    return this.http.put<TerminologyEntryItem[]>(`${environment.apiUrl}/terminology`, { entries });
  }
}
