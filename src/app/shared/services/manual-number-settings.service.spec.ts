import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ManualNumberSettingsService } from './manual-number-settings.service';
import { ManualNumberSettings } from '../models/manual-number-settings.model';
import { environment } from '../../../environments/environment';

const URL = `${environment.apiUrl}/identifier-settings/manual-numbers`;

function flags(overrides: Partial<ManualNumberSettings> = {}): ManualNumberSettings {
  return {
    parts: false, customers: false, vendors: false, leads: false,
    salesOrders: false, quotes: false, purchaseOrders: false,
    shipments: false, jobs: false, invoices: false, payments: false,
    ...overrides,
  };
}

describe('ManualNumberSettingsService', () => {
  let service: ManualNumberSettingsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ManualNumberSettingsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('picks up a flag turned on after the first load without a page reload', () => {
    service.load();
    httpMock.expectOne(URL).flush(flags());
    expect(service.isEnabled('jobs')).toBe(false);

    service.refresh();
    httpMock.expectOne(URL).flush(flags({ jobs: true }));

    expect(service.isEnabled('jobs')).toBe(true);
  });

  it('re-reads once more when a refresh arrives while an older read is still in flight', () => {
    service.load();
    const stale = httpMock.expectOne(URL);

    service.refresh();
    httpMock.expectNone(URL);
    stale.flush(flags());

    httpMock.expectOne(URL).flush(flags({ jobs: true }));
    expect(service.isEnabled('jobs')).toBe(true);
  });
});
