import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';

export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
  initials: string | null;
  avatarColor: string | null;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/auth`;

  updateProfile(request: UpdateProfileRequest): Observable<unknown> {
    return this.http.put(`${this.base}/profile`, request);
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/change-password`, request);
  }
}
