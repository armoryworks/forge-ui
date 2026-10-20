import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../../shared/services/auth.service';
import { PasskeyService } from '../../../../shared/services/passkey.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AccountService } from '../../services/account.service';
import { MfaService } from '../../services/mfa.service';
import { MfaStatus } from '../../models/mfa.model';
import { AccountSecurityComponent } from './account-security.component';

interface SecurityInternals {
  passwordForm: FormGroup;
  pinForm: FormGroup;
  changePassword(): void;
  setPin(): void;
  generateRecoveryCodes(): void;
  removeDevice(device: { id: number; deviceName: string | null; deviceType: string }): void;
  mfaStatus: ReturnType<typeof signal<MfaStatus | null>>;
}

describe('AccountSecurityComponent', () => {
  const auth = { user: signal(null), clearAuth: vi.fn(), setPin: vi.fn(() => of(undefined)) };
  const account = { changePassword: vi.fn() };
  const router = { navigate: vi.fn() };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(false) })) };
  const snackbar = { success: vi.fn(), error: vi.fn(), errorFrom: vi.fn() };
  let component: SecurityInternals;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: AccountService, useValue: account },
        { provide: MfaService, useValue: { getStatus: () => of(null) } },
        { provide: PasskeyService, useValue: { supported: () => false } },
        { provide: MatDialog, useValue: dialog },
        { provide: SnackbarService, useValue: snackbar },
        { provide: Router, useValue: router },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new AccountSecurityComponent()) as unknown as SecurityInternals;
  });

  const fillPassword = (current: string, next: string, confirm: string) =>
    component.passwordForm.setValue({ currentPassword: current, newPassword: next, confirmPassword: confirm });

  it('refuses a confirmation that differs from the new password and sends nothing', () => {
    fillPassword('Test1234!', 'NewPass1x', 'NewPass1y');

    expect(component.passwordForm.invalid).toBe(true);
    expect(component.passwordForm.get('confirmPassword')?.errors?.['mismatch']?.message).toBe('account.passwordsDoNotMatch');
    component.changePassword();
    expect(account.changePassword).not.toHaveBeenCalled();
  });

  it('re-checks the confirmation when the new password changes afterwards', () => {
    fillPassword('Test1234!', 'NewPass1x', 'NewPass1x');
    expect(component.passwordForm.valid).toBe(true);

    component.passwordForm.get('newPassword')?.setValue('NewPass1z');

    expect(component.passwordForm.get('confirmPassword')?.hasError('mismatch')).toBe(true);
  });

  it('explains the password rules before submitting', () => {
    fillPassword('Test1234!', 'ALLUPPER123', 'ALLUPPER123');

    expect(component.passwordForm.get('newPassword')?.errors?.['passwordPolicy']?.message).toBe('account.passwordNeedsLowercase');
  });

  it('signs the user out locally and explains why after a successful change', () => {
    account.changePassword.mockReturnValue(of(undefined));
    fillPassword('Test1234!', 'NewPass1x', 'NewPass1x');

    component.changePassword();

    expect(auth.clearAuth).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'password_changed' } });
  });

  it('shows a wrong current password against the field and keeps the session', () => {
    account.changePassword.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 400,
      error: { errors: [{ field: 'currentPassword', message: 'Current password is incorrect.' }] },
    })));
    fillPassword('Wrong1234', 'NewPass1x', 'NewPass1x');

    component.changePassword();

    expect(component.passwordForm.get('currentPassword')?.errors?.['serverError']?.message).toBe('Current password is incorrect.');
    expect(auth.clearAuth).not.toHaveBeenCalled();
  });

  it('refuses mismatched PINs and malformed PINs', () => {
    component.pinForm.setValue({ pin: '1234', confirmPin: '4321' });
    component.setPin();
    expect(auth.setPin).not.toHaveBeenCalled();

    component.pinForm.setValue({ pin: 'abcd', confirmPin: 'abcd' });
    expect(component.pinForm.get('pin')?.errors?.['pinFormat']?.message).toBe('account.pinFormatInvalid');

    component.pinForm.setValue({ pin: '1234', confirmPin: '1234' });
    component.setPin();
    expect(auth.setPin).toHaveBeenCalledWith('1234');
  });

  it('asks before replacing existing recovery codes', () => {
    component.mfaStatus.set({ isEnabled: true, isEnforcedByPolicy: false, devices: [], recoveryCodesRemaining: 7 } as MfaStatus);

    component.generateRecoveryCodes();

    expect(dialog.open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ data: { remainingCodes: 7 } }));
  });

  it('warns that removing the only device turns two-factor off', () => {
    const device = { id: 3, deviceName: 'Authenticator App', deviceType: 'Totp' };
    component.mfaStatus.set({ isEnabled: true, isEnforcedByPolicy: false, devices: [device], recoveryCodesRemaining: 10 } as unknown as MfaStatus);

    component.removeDevice(device);

    expect(dialog.open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      data: expect.objectContaining({ message: 'account.mfaRemoveLastDevice' }),
    }));
  });
});
