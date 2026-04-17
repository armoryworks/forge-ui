import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Component } from '@angular/core';

import { AuthService } from '../../../shared/services/auth.service';
import { ClockEventTypeService } from '../../../shared/services/clock-event-type.service';

// Stub the LoadingBlockDirective to avoid input.required errors
import { Directive, Input } from '@angular/core';
@Directive({ selector: '[appLoadingBlock]', standalone: true })
class MockLoadingBlockDirective {
  @Input() appLoadingBlock: boolean = false;
}

// We test the component logic by importing it and overriding the directive
import { MobileHomeComponent } from './mobile-home.component';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';

describe('MobileHomeComponent', () => {
  let fixture: ComponentFixture<MobileHomeComponent>;
  let component: MobileHomeComponent;
  let httpTesting: HttpTestingController;

  const mockUser = { id: 1, firstName: 'John', lastName: 'Doe' };

  const mockAuthService = {
    user: signal(mockUser),
  };

  const mockClockTypes = {
    getLabel: vi.fn().mockReturnValue('Currently Working'),
    getStatusCssClass: vi.fn().mockReturnValue('in'),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [MobileHomeComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: ClockEventTypeService, useValue: mockClockTypes },
      ],
    })
      .overrideComponent(MobileHomeComponent, {
        remove: { imports: [LoadingBlockDirective] },
        add: { imports: [MockLoadingBlockDirective] },
      })
      .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  function createComponent(): MobileHomeComponent {
    fixture = TestBed.createComponent(MobileHomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return component;
  }

  function flushInitRequests(clockStatusOverride?: Record<string, unknown>): void {
    const defaultStatus = {
      isClockedIn: false,
      status: 'Out',
      clockedInAt: null,
      currentJobNumber: null,
      timeOnTask: '00:00',
    };
    httpTesting.expectOne('/api/v1/time-tracking/clock-status').flush(
      clockStatusOverride ?? defaultStatus,
    );
    httpTesting.expectOne((req) => req.url === '/api/v1/jobs').flush({ data: [] });
  }

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    const comp = createComponent();
    flushInitRequests();
    expect(comp).toBeTruthy();
  });

  it('should load clock status on init', () => {
    createComponent();

    const clockReq = httpTesting.expectOne('/api/v1/time-tracking/clock-status');
    expect(clockReq.request.method).toBe('GET');
    clockReq.flush({
      isClockedIn: true,
      status: 'In',
      clockedInAt: '2026-04-10T08:00:00Z',
      currentJobNumber: 'JOB-001',
      timeOnTask: '02:30',
    });

    httpTesting.expectOne((req) => req.url === '/api/v1/jobs').flush({ data: [] });

    expect(component.clockStatus()).toBeTruthy();
    expect(component.clockStatus()?.isClockedIn).toBe(true);
    expect(component.clockStatus()?.status).toBe('In');
  });

  it('should load active jobs on init', () => {
    createComponent();

    httpTesting.expectOne('/api/v1/time-tracking/clock-status').flush({
      isClockedIn: false, status: 'Out', clockedInAt: null, currentJobNumber: null, timeOnTask: '00:00',
    });

    const jobsReq = httpTesting.expectOne((req) => req.url === '/api/v1/jobs');
    expect(jobsReq.request.method).toBe('GET');
    expect(jobsReq.request.params.get('assigneeId')).toBe(mockUser.id.toString());
    expect(jobsReq.request.params.get('pageSize')).toBe('5');

    jobsReq.flush({
      data: [
        { id: 1, jobNumber: 'JOB-001', title: 'Test Job', stageName: 'In Production', stageColor: '#00ff00', hasActiveTimer: false },
      ],
    });

    expect(component.activeJobs().length).toBe(1);
    expect(component.activeJobs()[0].jobNumber).toBe('JOB-001');
    expect(component.loading()).toBe(false);
  });

  it('greeting should return correct time-based greeting', () => {
    createComponent();
    flushInitRequests();

    const greeting = component.greeting;
    expect(['Good morning', 'Good afternoon', 'Good evening']).toContain(greeting);
  });

  it('statusLabel should return correct label from clock types service', () => {
    createComponent();

    httpTesting.expectOne('/api/v1/time-tracking/clock-status').flush({
      isClockedIn: true, status: 'In', clockedInAt: '2026-04-10T08:00:00Z',
      currentJobNumber: null, timeOnTask: '01:00',
    });
    httpTesting.expectOne((req) => req.url === '/api/v1/jobs').flush({ data: [] });

    const label = component.statusLabel;
    expect(mockClockTypes.getLabel).toHaveBeenCalledWith('In');
    expect(label).toBe('Currently Working');
  });
});
