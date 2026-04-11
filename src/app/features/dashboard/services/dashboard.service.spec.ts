import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { DashboardService } from './dashboard.service';
import { DashboardData } from '../models/dashboard-data.model';
import { DashboardLayout } from '../models/dashboard-layout.model';
import { environment } from '../../../../environments/environment';

describe('DashboardService', () => {
  let service: DashboardService;
  let httpMock: HttpTestingController;

  const mockDashboardData: DashboardData = {
    tasks: [],
    stages: [],
    team: [],
    activity: [],
    deadlines: [],
    kpis: {} as DashboardData['kpis'],
  };

  const mockLayout: DashboardLayout = {
    role: 'Admin',
    visibleWidgets: ['tasks', 'stages', 'team'],
    columns: 3,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DashboardService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(DashboardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── getDashboard ──

  it('getDashboard should fetch dashboard data', () => {
    service.getDashboard().subscribe((data) => {
      expect(data).toEqual(mockDashboardData);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/dashboard`);
    expect(req.request.method).toBe('GET');
    req.flush(mockDashboardData);
  });

  // ── getDefaultLayout ──

  it('getDefaultLayout should return layout configuration', () => {
    service.getDefaultLayout().subscribe((layout) => {
      expect(layout.role).toBe('Admin');
      expect(layout.visibleWidgets).toEqual(['tasks', 'stages', 'team']);
      expect(layout.columns).toBe(3);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/dashboard/layout`);
    expect(req.request.method).toBe('GET');
    req.flush(mockLayout);
  });
});
