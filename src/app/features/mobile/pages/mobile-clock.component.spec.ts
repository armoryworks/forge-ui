import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';

import { AuthService } from '../../../shared/services/auth.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { ClockEventTypeService } from '../../../shared/services/clock-event-type.service';

// Stub the LoadingBlockDirective to avoid input.required errors
import { Directive, Input } from '@angular/core';
@Directive({ selector: '[appLoadingBlock]', standalone: true })
class MockLoadingBlockDirective {
  @Input() appLoadingBlock: boolean = false;
}

import { MobileClockComponent } from './mobile-clock.component';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';

describe('MobileClockComponent', () => {
  let fixture: ComponentFixture<MobileClockComponent>;
  let component: MobileClockComponent;
  let httpTesting: HttpTestingController;

  const mockUser = { id: 1, firstName: 'John', lastName: 'Doe' };

  const mockAuthService = {
    user: signal(mockUser),
  };

  const mockSnackbar = {
    success: vi.fn(),
    error: vi.fn(),
  };

  const mockClockTypes = {
    load: vi.fn(),
    getLabel: vi.fn().mockReturnValue('Clocked Out'),
    getStatusCssClass: vi.fn().mockReturnValue('out'),
    getAvailableActions: vi.fn().mockReturnValue([
      { code: 'ClockIn', label: 'Clock In', statusMapping: 'In', oppositeCode: 'ClockOut', category: 'work', countsAsActive: true, isMismatchable: false, icon: 'login', color: '#22c55e' },
    ]),
    definitions: signal([]),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [MobileClockComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: SnackbarService, useValue: mockSnackbar },
        { provide: ClockEventTypeService, useValue: mockClockTypes },
      ],
    })
      .overrideComponent(MobileClockComponent, {
        remove: { imports: [LoadingBlockDirective] },
        add: { imports: [MockLoadingBlockDirective] },
      })
      .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  function createComponent(): MobileClockComponent {
    fixture = TestBed.createComponent(MobileClockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return component;
  }

  function flushInitRequests(): void {
    httpTesting.expectOne(`/api/v1/shop-floor/clock-status/${mockUser.id}`).flush({
      isClockedIn: false,
      status: 'Out',
      clockedInAt: null,
    });
  }

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    const comp = createComponent();
    flushInitRequests();
    expect(comp).toBeTruthy();
  });

  it('should load clock event types on init', () => {
    createComponent();
    flushInitRequests();
    expect(mockClockTypes.load).toHaveBeenCalled();
  });

  it('should load current status on init', () => {
    createComponent();

    const req = httpTesting.expectOne(`/api/v1/shop-floor/clock-status/${mockUser.id}`);
    expect(req.request.method).toBe('GET');
    req.flush({
      isClockedIn: true,
      status: 'In',
      clockedInAt: '2026-04-10T08:00:00Z',
    });

    expect(component.status()).toBeTruthy();
    expect(component.status()?.isClockedIn).toBe(true);
    expect(component.loading()).toBe(false);
  });

  it('should display available actions', () => {
    createComponent();
    flushInitRequests();

    expect(mockClockTypes.getAvailableActions).toHaveBeenCalledWith('Out');
    expect(component.actions().length).toBe(1);
    expect(component.actions()[0].code).toBe('ClockIn');
  });

  it('should submit clock event', () => {
    createComponent();
    flushInitRequests();

    const action = {
      code: 'ClockIn',
      label: 'Clock In',
      statusMapping: 'In',
      oppositeCode: 'ClockOut',
      category: 'work',
      countsAsActive: true,
      isMismatchable: false,
      icon: 'login',
      color: '#22c55e',
    };

    component.submitClock(action);

    const clockReq = httpTesting.expectOne('/api/v1/shop-floor/clock');
    expect(clockReq.request.method).toBe('POST');
    expect(clockReq.request.body).toEqual({
      userId: mockUser.id,
      eventType: 'ClockIn',
    });
    clockReq.flush({});

    expect(mockSnackbar.success).toHaveBeenCalledWith('Clock In recorded');
    expect(component.submitting()).toBe(false);

    // Should reload status after successful submit
    httpTesting.expectOne(`/api/v1/shop-floor/clock-status/${mockUser.id}`).flush({
      isClockedIn: true,
      status: 'In',
      clockedInAt: '2026-04-10T08:00:00Z',
    });
  });

  it('should show error snackbar on submit failure', () => {
    createComponent();
    flushInitRequests();

    const action = {
      code: 'ClockIn',
      label: 'Clock In',
      statusMapping: 'In',
      oppositeCode: 'ClockOut',
      category: 'work',
      countsAsActive: true,
      isMismatchable: false,
      icon: 'login',
      color: '#22c55e',
    };

    component.submitClock(action);

    httpTesting.expectOne('/api/v1/shop-floor/clock').flush(
      { message: 'Server error' },
      { status: 500, statusText: 'Internal Server Error' },
    );

    expect(mockSnackbar.error).toHaveBeenCalledWith('Failed to record clock event');
    expect(component.submitting()).toBe(false);
  });
});
