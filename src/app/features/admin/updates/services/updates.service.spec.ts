import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { environment } from '../../../../../environments/environment';
import { DeployAvailability, DeployJob } from '../models/update.model';
import { UpdatesService } from './updates.service';

describe('UpdatesService', () => {
  let service: UpdatesService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/admin/updates`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [UpdatesService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UpdatesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reports an unreachable registry as unknown, never as current', () => {
    let result: DeployAvailability | undefined;
    service.getAvailability().subscribe((a) => (result = a));

    http.expectOne(`${base}/available`).flush({
      status: 'unknown',
      newestRelease: null,
      message: 'registry unreachable',
    } satisfies DeployAvailability);

    expect(result?.status).toBe('unknown');
    expect(result?.status).not.toBe('current');
  });

  it('sends the confirmation word and the approved job on a destructive approval', () => {
    service
      .startJob({ action: 'updateApprove', confirm: 'APPLY', approvedFromJobId: 'job-1' })
      .subscribe();

    const req = http.expectOne(`${base}/jobs`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.confirm).toBe('APPLY');
    expect(req.request.body.approvedFromJobId).toBe('job-1');
    req.flush({ id: 'job-2', state: 'running' } as unknown as DeployJob);
  });

  it('requests the log from a byte offset so progress appends rather than repeats', () => {
    service.getJobLog('job-1', 512).subscribe();

    const req = http.expectOne((r) => r.url === `${base}/jobs/job-1/log`);
    expect(req.request.params.get('offset')).toBe('512');
    req.flush('...more output');
  });
});
