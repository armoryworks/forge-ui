import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DashboardData } from '../models/dashboard.model';
import { MOCK_DASHBOARD } from './dashboard-mock.data';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  getDashboard(): Observable<DashboardData> {
    if (environment.mockIntegrations) {
      return of(MOCK_DASHBOARD);
    }
    return this.http.get<DashboardData>(`${environment.apiUrl}/dashboard`);
  }
}
