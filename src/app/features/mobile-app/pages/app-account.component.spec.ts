import { Signal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl } from '@angular/forms';
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
  signOut(): Promise<void>;
  confirmingSignOut: Signal<boolean>;
  problemControl: FormControl<string>;
  sendProblem(): Promise<void>;
  noScreens: Signal<boolean>;
  myDevices: Signal<MobileDevice[]>;
  devicesProblem: Signal<'forbidden' | 'failed' | null>;
  biometricAvailable: Signal<boolean>;
}

describe('AppAccountComponent', () => {
  let enabled: (code: string) => boolean;
  let devices: () => Observable<MobileDevice[]>;
  let mobileShell: boolean;
  const auth = { user: signal(null), logout: vi.fn() };
  const router = { navigate: vi.fn(), navigateByUrl: vi.fn() };
  const revoke = vi.fn();
  const lock = { biometricEnabled: signal(false), biometricAvailable: vi.fn() };
  const instances = { instance: signal({ id: 'shop', shared: false, deviceId: 9 }), instances: signal([]), remove: vi.fn() };
  let report: () => Observable<void>;
  let snackbar: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  function create(): AccountInternals {
    return TestBed.runInInjectionContext(() => new AppAccountComponent()) as unknown as AccountInternals;
  }

  beforeEach(() => {
    enabled = () => true;
    devices = () => of([]);
    mobileShell = false;
    auth.logout.mockReset().mockResolvedValue(true);
    router.navigate.mockReset();
    revoke.mockReset().mockReturnValue(of(undefined));
    instances.remove.mockReset().mockResolvedValue(undefined);
    lock.biometricAvailable.mockReset().mockResolvedValue(false);
    report = () => of(undefined);
    snackbar = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarService, useValue: snackbar },
        { provide: AuthService, useValue: auth },
        { provide: MobileAuthService, useValue: { wipeAndRestart: vi.fn() } },
        { provide: MobileDevicesService, useValue: { mine: () => devices(), revoke, reportProblem: () => report() } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => enabled(code) } },
        { provide: InstanceService, useValue: instances },
        { provide: LocalLockService, useValue: lock },
        { provide: CrashReportingService, useValue: { available: signal(false), enabled: signal(false) } },
        { provide: PlatformService, useValue: { name: 'web', get mobileShell() { return mobileShell; } } },
        { provide: AppInfoService, useValue: { version: signal('1.0.0'), build: signal(null) } },
      ],
    });
  });

  it('offers the biometric switch only when the device can unlock that way', async () => {
    const without = create();
    await Promise.resolve();
    expect(without.biometricAvailable()).toBe(false);

    lock.biometricAvailable.mockResolvedValue(true);
    const withIt = create();
    await vi.waitFor(() => expect(withIt.biometricAvailable()).toBe(true));
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

  it('in a browser, signs out of the web session after a second tap', async () => {
    const account = create();

    await account.signOut();
    expect(account.confirmingSignOut()).toBe(true);
    expect(auth.logout).not.toHaveBeenCalled();

    await account.signOut();
    expect(auth.logout).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('on the phone, signs this device out and removes the server from it', async () => {
    mobileShell = true;
    devices = () => of([{ id: 9, revokedAt: null } as MobileDevice]);
    const account = create();

    await account.signOut();
    await account.signOut();

    expect(revoke).toHaveBeenCalledWith(9);
    expect(instances.remove).toHaveBeenCalledWith('shop');
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('blocks a problem report that is only spaces', () => {
    const account = create();
    account.problemControl.setValue('   ');
    expect(account.problemControl.invalid).toBe(true);
  });

  it('says to retry when online only when the report could not reach the server', async () => {
    report = () => throwError(() => new HttpErrorResponse({ status: 0 }));
    const account = create();
    account.problemControl.setValue('Scanner froze');
    await account.sendProblem();
    expect(snackbar.error).toHaveBeenCalledWith('mobileApp.account.problemFailed');
  });

  it('says the report was refused when the server rejects it', async () => {
    report = () => throwError(() => new HttpErrorResponse({ status: 500 }));
    const account = create();
    account.problemControl.setValue('Scanner froze');
    await account.sendProblem();
    expect(snackbar.error).toHaveBeenCalledWith('mobileApp.account.problemRejected');
  });
});
