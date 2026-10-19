import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { of } from 'rxjs';

import { MfaChallengeComponent } from './mfa-challenge.component';
import { MfaService } from '../account/services/mfa.service';
import { SnackbarService } from '../../shared/services/snackbar.service';

interface ChallengeInternals {
  codeForm: FormGroup;
  submitCode(): void;
}

describe('MfaChallengeComponent', () => {
  const mfa = {
    createChallenge: vi.fn(() => of({ challengeToken: 'challenge-1', maskedTarget: null })),
    validateChallenge: vi.fn(() => of({ accessToken: 'a', refreshToken: 'r', expiresAt: '2026-10-19T00:00:00Z' })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [MfaChallengeComponent],
      providers: [
        { provide: MfaService, useValue: mfa },
        { provide: SnackbarService, useValue: { errorFrom: vi.fn() } },
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
});
