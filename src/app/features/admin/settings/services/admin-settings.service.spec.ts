import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { vi } from 'vitest';

import { AdminSettingsService } from './admin-settings.service';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';

describe('AdminSettingsService', () => {
  let service: AdminSettingsService;
  let httpMock: HttpTestingController;
  const refresh = vi.fn();

  beforeEach(() => {
    refresh.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ManualNumberSettingsService, useValue: { refresh } },
      ],
    });
    service = TestBed.inject(AdminSettingsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('reads one settings group', () => {
    let keys: string[] = [];
    service.getGroup('Numbering').subscribe((entries) => (keys = entries.map((e) => e.key)));

    const req = httpMock.expectOne('/api/v1/admin/settings?group=Numbering');
    expect(req.request.method).toBe('GET');
    req.flush([{ key: 'jobs.allow_manual_numbers' }]);

    expect(keys).toEqual(['jobs.allow_manual_numbers']);
  });

  it('refreshes the app-wide manual-number flags after saving one', () => {
    service.updateSetting('jobs.allow_manual_numbers', 'true').subscribe();
    httpMock.expectOne('/api/v1/admin/settings/jobs.allow_manual_numbers').flush(null);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('leaves the manual-number flags alone for other settings', () => {
    service.updateSetting('app.name', 'Forge').subscribe();
    httpMock.expectOne('/api/v1/admin/settings/app.name').flush(null);

    expect(refresh).not.toHaveBeenCalled();
  });
});
