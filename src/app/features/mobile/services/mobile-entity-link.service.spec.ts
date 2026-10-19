import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { DesktopPreferenceService } from '../../../shared/services/desktop-preference.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { MobileEntityLinkService } from './mobile-entity-link.service';

describe('MobileEntityLinkService', () => {
  let service: MobileEntityLinkService;
  const navigate = vi.fn();
  const prefer = vi.fn();
  const snackbarError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: Router, useValue: { navigate } },
        { provide: DesktopPreferenceService, useValue: { prefer } },
        { provide: SnackbarService, useValue: { error: snackbarError } },
      ],
    });
    service = TestBed.inject(MobileEntityLinkService);
  });

  it('keeps a job inside the mobile shell', () => {
    const target = service.targetFor('Job', 42)!;
    expect(target).toEqual({ route: { path: ['/m/jobs', 42] }, desktop: false });

    service.open(target);

    expect(prefer).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/m/jobs', 42], { queryParams: undefined });
  });

  it('sends other mapped entities to the desktop site', () => {
    prefer.mockReturnValue(true);
    const target = service.targetFor('salesOrder', 7)!;
    expect(target.desktop).toBe(true);

    service.open(target);

    expect(prefer).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/sales-orders'], { queryParams: { id: 7 } });
  });

  it('stays put and says why when the browser blocks storage', () => {
    prefer.mockReturnValue(false);

    service.open(service.targetFor('part', 3)!);

    expect(navigate).not.toHaveBeenCalled();
    expect(snackbarError).toHaveBeenCalledWith('mobileWeb.desktopLink.storageBlocked');
  });

  it('has no target for unmapped kinds or a missing id', () => {
    expect(service.targetFor('bin', 3)).toBeNull();
    expect(service.targetFor('job', null)).toBeNull();
    expect(service.targetFor(undefined, 3)).toBeNull();
  });
});
