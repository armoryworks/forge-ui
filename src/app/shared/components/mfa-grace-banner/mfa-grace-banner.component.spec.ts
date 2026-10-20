import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { MfaGraceBannerComponent, MFA_GRACE_BANNER_DISMISSED_KEY } from './mfa-grace-banner.component';
import { AuthService, AuthUser } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import { LayoutService } from '../../services/layout.service';

const DAY_MS = 24 * 60 * 60 * 1000;

function userWith(deadline: string | null, id = 7): AuthUser {
  return {
    id, email: 'u@forge.test', firstName: 'U', lastName: 'Ser', initials: 'US', avatarColor: null,
    roles: ['Controller'], profileComplete: true, mfaEnrollmentDeadline: deadline,
  };
}

function setup(options: { user: AuthUser | null; accountRoute?: boolean }) {
  const user = signal<AuthUser | null>(options.user);
  const navigate = vi.fn(() => Promise.resolve(true));

  TestBed.configureTestingModule({
    imports: [MfaGraceBannerComponent, TranslateModule.forRoot()],
    providers: [
      { provide: AuthService, useValue: { isAuthenticated: () => user() !== null, user } },
      { provide: LanguageService, useValue: { currentLanguage: signal('en') } },
      { provide: LayoutService, useValue: { isAccountRoute: () => options.accountRoute ?? false } },
      { provide: Router, useValue: { navigate } },
    ],
  });

  const fixture = TestBed.createComponent(MfaGraceBannerComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const banner = () => el.querySelector('[data-testid="mfa-grace-banner"]');
  const click = (testId: string) => {
    (el.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement).click();
    fixture.detectChanges();
  };
  return { fixture, el, banner, click, navigate, user };
}

describe('MfaGraceBannerComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

  it('shows while the user is inside their enrolment grace window', () => {
    const { banner, el } = setup({ user: userWith(new Date(Date.now() + 3 * DAY_MS).toISOString()) });

    expect(banner()).not.toBeNull();
    expect(el.textContent).toContain('mfaGraceBanner.message');
  });

  it('stays hidden without a deadline, after it passes, or on the account screens', () => {
    expect(setup({ user: userWith(null) }).banner()).toBeNull();
    TestBed.resetTestingModule();
    expect(setup({ user: userWith(new Date(Date.now() - DAY_MS).toISOString()) }).banner()).toBeNull();
    TestBed.resetTestingModule();
    expect(setup({ user: userWith(new Date(Date.now() + DAY_MS).toISOString()), accountRoute: true }).banner()).toBeNull();
  });

  it('opens the enrolment screen', () => {
    const { click, navigate } = setup({ user: userWith(new Date(Date.now() + DAY_MS).toISOString()) });

    click('mfa-grace-setup-btn');

    expect(navigate).toHaveBeenCalledWith(['/account/security']);
  });

  it('dismisses for the rest of the session for that user only', () => {
    const deadline = new Date(Date.now() + DAY_MS).toISOString();
    const { click, banner } = setup({ user: userWith(deadline) });

    click('mfa-grace-dismiss-btn');

    expect(banner()).toBeNull();
    expect(sessionStorage.getItem(MFA_GRACE_BANNER_DISMISSED_KEY)).toBe('7');
    TestBed.resetTestingModule();
    expect(setup({ user: userWith(deadline) }).banner()).toBeNull();
    TestBed.resetTestingModule();
    expect(setup({ user: userWith(deadline, 8) }).banner()).not.toBeNull();
  });

  it('disappears once the deadline is cleared by enrolling', () => {
    const { fixture, banner, user } = setup({ user: userWith(new Date(Date.now() + DAY_MS).toISOString()) });

    user.set(userWith(null));
    fixture.detectChanges();

    expect(banner()).toBeNull();
  });
});
