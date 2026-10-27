import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, beforeEach, afterEach } from 'vitest';

import { environment } from '../../../../environments/environment';
import { JobImportService } from './job-import.service';

describe('JobImportService', () => {
  let service: JobImportService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(JobImportService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts rows to validate and to commit', () => {
    service.validate([]).subscribe();
    http.expectOne(r => r.method === 'POST' && r.url === `${environment.apiUrl}/imports/jobs/validate`).flush({});
    service.commit([]).subscribe();
    http.expectOne(r => r.method === 'POST' && r.url === `${environment.apiUrl}/imports/jobs/commit`).flush({});
  });
});
