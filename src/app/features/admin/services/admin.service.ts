import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AdminUser, CreateUserRequest, UpdateUserRequest, TrackType, ReferenceDataGroup, ReferenceDataEntry } from '../models/admin.model';

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
}
