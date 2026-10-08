import { Signal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

import { Observable, of, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { MobileDevice } from '../../../shared/models/mobile-device.model';
import { AppInfoService } from '../../../shared/services/app-info.service';
import { AuthService } from '../../../shared/services/auth.service';
import { CapabilityService } from '../../../shared/services/capability.service';
import { CrashReportingService } from '../../../shared/services/crash-reporting.service';
import { InstanceService } from '../../../shared/services/instance.service';
import { LocalLockService } from '../../../shared/services/local-lock.service';
import { MobileAuthService } from '../../../shared/services/mobile-auth.service';
import { MobileDevicesService } from '../../../shared/services/mobile-devices.service';
import { PlatformService } from '../../../shared/services/platform.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { AppAccountComponent } from './app-account.component';

interface AccountInternals {
  noScreens: Signal<boolean>;
  myDevices: Signal<MobileDevice[]>;
  devicesProblem: Signal<'forbidden' | 'failed' | null>;
}

describe('AppAccountComponent', () => {
  let enabled: (code: string) => boolean;
  let devices: () => Observable<MobileDevice[]>;

  function create(): AccountInternals {
    return TestBed.runInInjectionContext(() => new AppAccountComponent()) as unknown as AccountInternals;
  }

  beforeEach(() => {
    enabled = () => true;
    devices = () => of([]);
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: vi.fn(), navigateByUrl: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: AuthService, useValue: { user: signal(null) } },
        { provide: MobileAuthService, useValue: {} },
        { provide: MobileDevicesService, useValue: { mine: () => devices() } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => enabled(code) } },
        { provide: InstanceService, useValue: { instance: signal({ id: 'shop', shared: false }), instances: signal([]) } },
        { provide: LocalLockService, useValue: { biometricEnabled: signal(false) } },
        { provide: CrashReportingService, useValue: { available: signal(false), enabled: signal(false) } },
        { provide: PlatformService, useValue: { name: 'web' } },
        { provide: AppInfoService, useValue: { version: signal('1.0.0'), build: signal(null) } },
      ],
    });
  });

  it('explains when no phone screen is turned on for the shop', () => {
    enabled = () => false;
    expect(create().noScreens()).toBe(true);
  });

  it('says nothing while any phone screen is on', () => {
    enabled = (code) => code === 'CAP-MOBILE-CLOCK';
    expect(create().noScreens()).toBe(false);
  });

  it('tells a person refused the device list that they have no access, not that nothing is enrolled', () => {
    devices = () => throwError(() => new HttpErrorResponse({ status: 403 }));
    const account = create();

    expect(account.devicesProblem()).toBe('forbidden');
    expect(account.myDevices()).toEqual([]);
  });

  it('says the list did not load for any other failure', () => {
    devices = () => throwError(() => new HttpErrorResponse({ status: 500 }));
    expect(create().devicesProblem()).toBe('failed');
  });

  it('reports no problem when the list loads empty', () => {
    expect(create().devicesProblem()).toBeNull();
  });
});
