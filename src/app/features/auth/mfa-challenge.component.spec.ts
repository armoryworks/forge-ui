import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { Observable, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';

import { MfaChallengeComponent } from './mfa-challenge.component';
import { MfaService } from '../account/services/mfa.service';
import { SnackbarService } from '../../shared/services/snackbar.service';

interface ChallengeInternals {
  codeForm: FormGroup;
  submitCode(): void;
  error(): string | null;
}

describe('MfaChallengeComponent', () => {
  const mfa = {
    createChallenge: vi.fn(() => of({ challengeToken: 'challenge-1', maskedTarget: null })),
    validateChallenge: vi.fn((): Observable<unknown> => of({ accessToken: 'a', refreshToken: 'r', expiresAt: '2026-10-19T00:00:00Z' })),
  };
  const snackbar = { errorFrom: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [MfaChallengeComponent],
      providers: [
        provideTranslateService(),
        { provide: MfaService, useValue: mfa },
        { provide: SnackbarService, useValue: snackbar },
      ],
    });
  });

  function create(allowRememberDevice?: boolean) {
    const fixture = TestBed.createComponent(MfaChallengeComponent);
    fixture.componentRef.setInput('pendingToken', 'pending-1');
    if (allowRememberDevice !== undefined) fixture.componentRef.setInput('allowRememberDevice', allowRememberDevice);
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance as unknown as ChallengeInternals };
  }

  const submitWithRemember = (c: ChallengeInternals): void => {
    c.codeForm.setValue({ code: '123456', rememberDevice: true });
    c.submitCode();
  };

  it('offers to remember the device by default and passes the choice on', () => {
    const { fixture, c } = create();

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="mfa-remember-device"]')).not.toBeNull();
    submitWithRemember(c);
    expect(mfa.validateChallenge).toHaveBeenCalledWith({ challengeToken: 'challenge-1', code: '123456', rememberDevice: true });
  });

  it('never asks the server to trust a device when remembering is turned off', () => {
    const { fixture, c } = create(false);

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="mfa-remember-device"]')).toBeNull();
    submitWithRemember(c);
    expect(mfa.validateChallenge).toHaveBeenCalledWith({ challengeToken: 'challenge-1', code: '123456', rememberDevice: false });
  });

  const failWith = (status: number) =>
    mfa.validateChallenge.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));

  it('says the code is wrong and clears it on a rejected code', () => {
    failWith(401);
    const { c } = create();
    submitWithRemember(c);
    expect(c.error()).toBe('auth.mfa.invalidCode');
    expect(c.codeForm.value.code).toBe('');
  });

  it('keeps the typed code and reports the failure when the server cannot be reached', () => {
    failWith(0);
    const { c } = create();
    submitWithRemember(c);
    expect(snackbar.errorFrom).toHaveBeenCalledWith(expect.anything(), 'auth.mfa.verifyFailed');
    expect(c.error()).toBeNull();
    expect(c.codeForm.value.code).toBe('123456');
  });

  it('reports too many attempts instead of a wrong code on a 429', () => {
    failWith(429);
    const { c } = create();
    submitWithRemember(c);
    expect(c.error()).toBe('auth.mfa.tooManyAttempts');
    expect(c.codeForm.value.code).toBe('123456');
  });

  it('switches to the lockout message after repeated rejected codes', () => {
    failWith(401);
    const { c } = create();
    for (let i = 0; i < 5; i++) submitWithRemember(c);
    expect(c.error()).toBe('auth.mfa.tooManyAttempts');
  });

  it('sends the user back to sign in when the challenge has expired', () => {
    failWith(401);
    const { fixture, c } = create();
    const cancelled = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelled);
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 6 * 60 * 1000);
    submitWithRemember(c);
    clock.mockRestore();
    expect(snackbar.error).toHaveBeenCalledWith('auth.mfa.challengeExpired');
    expect(cancelled).toHaveBeenCalled();
  });
});
