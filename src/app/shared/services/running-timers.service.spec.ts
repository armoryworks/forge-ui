import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { RunningTimersService } from './running-timers.service';

describe('RunningTimersService', () => {
  let service: RunningTimersService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/time-tracking`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RunningTimersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the caller\'s own open timers', () => {
    service.getMine().subscribe();
    const req = http.expectOne(`${base}/timers/active`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('stops one timer by its time entry id', () => {
    service.stop(15).subscribe();
    const req = http.expectOne(`${base}/timer/stop`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ timeEntryId: 15 });
    req.flush({});
  });

  it('sends stop notes when given', () => {
    service.stop(15, 'end of shift').subscribe();
    const req = http.expectOne(`${base}/timer/stop`);
    expect(req.request.body).toEqual({ timeEntryId: 15, notes: 'end of shift' });
    req.flush({});
  });
});
