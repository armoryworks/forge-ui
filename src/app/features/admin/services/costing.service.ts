import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { CostingProfile } from '../costing/models/costing-profile.model';

/** Tier 2 costing configuration — read/write the active costing profile (mode + departmental rates).
 *  Gated server-side by CAP-COSTING-TIER2-DEPTRATES; Admin/Manager read, Admin write. */
@Injectable({ providedIn: 'root' })
export class CostingService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/costing`;

  getProfile(): Observable<CostingProfile> {
    return this.http.get<CostingProfile>(`${this.base}/profile`);
  }

  updateProfile(profile: CostingProfile): Observable<void> {
    return this.http.put<void>(`${this.base}/profile`, profile);
  }
}
