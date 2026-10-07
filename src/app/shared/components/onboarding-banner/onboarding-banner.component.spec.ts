import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';

import { OnboardingBannerComponent, ONBOARDING_BANNER_DISMISSED_UNTIL_KEY } from './onboarding-banner.component';
import { AuthService } from '../../services/auth.service';
import { CapabilityService } from '../../services/capability.service';
import { LayoutService } from '../../services/layout.service';
import { UserPreferencesService } from '../../services/user-preferences.service';
import { EmployeeProfileService } from '../../../features/account/services/employee-profile.service';
import { OnboardingService } from '../../../features/onboarding/onboarding.service';

function setup(options: { hrOn: boolean; dismissedUntil?: string | null }) {
  const prefs = signal<Map<string, unknown>>(
    new Map(options.dismissedUntil ? [[ONBOARDING_BANNER_DISMISSED_UNTIL_KEY, options.dismissedUntil]] : []),
  );
  const preferences = {
    get: <T>(key: string) => (prefs().get(key) as T) ?? null,
    set: vi.fn((key: string, value: unknown) => prefs.update(m => new Map(m).set(key, value))),
  };
  const bypass$ = new Subject<void>();
  const onboardingService = { bypass: vi.fn(() => bypass$.asObservable()) };
  const profileService = {
    completeness: signal({ isComplete: false }),
    incompleteSectionCount: signal(2),
    load: vi.fn(),
    firstIncompleteRoute: () => '/account/profile',
  };

  TestBed.configureTestingModule({
    imports: [OnboardingBannerComponent, TranslateModule.forRoot()],
    providers: [
      { provide: AuthService, useValue: { isAuthenticated: () => true, user: () => ({ profileComplete: false }) } },
      { provide: CapabilityService, useValue: { isEnabled: (code: string) => options.hrOn && code === 'CAP-HR-HIRE' } },
      { provide: LayoutService, useValue: { isAccountRoute: () => false, isOnboardingRoute: () => false } },
      { provide: UserPreferencesService, useValue: preferences },
      { provide: EmployeeProfileService, useValue: profileService },
      { provide: OnboardingService, useValue: onboardingService },
      { provide: Router, useValue: { navigate: vi.fn() } },
    ],
  });

  const fixture = TestBed.createComponent(OnboardingBannerComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const click = (testId: string) => {
    (el.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement).click();
    fixture.detectChanges();
  };
  return { fixture, el, click, preferences, bypass$ };
}

describe('OnboardingBannerComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('never shows when HR tracking is off', () => {
    const { el } = setup({ hrOn: false });
    expect(el.querySelector('.onboarding-banner')).toBeNull();
  });

  it('shows the paperwork reminder and Skip when HR tracking is on', () => {
    const { el } = setup({ hrOn: true });
    expect(el.querySelector('.onboarding-banner')).not.toBeNull();
    expect(el.textContent).toContain('onboarding.paperworkRemaining');
    expect(el.querySelector('[data-testid="onboarding-skip-btn"]')).not.toBeNull();
  });

  it('persists a dismissal for seven days', () => {
    const { el, click, preferences } = setup({ hrOn: true });
    const before = Date.now();

    click('onboarding-dismiss-btn');

    expect(el.querySelector('.onboarding-banner')).toBeNull();
    const [key, value] = preferences.set.mock.calls[0];
    expect(key).toBe(ONBOARDING_BANNER_DISMISSED_UNTIL_KEY);
    const days = (Date.parse(value as string) - before) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThan(7.01);
  });

  it('stays hidden while a dismissal has not expired and returns after it has', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(setup({ hrOn: true, dismissedUntil: future }).el.querySelector('.onboarding-banner')).toBeNull();

    TestBed.resetTestingModule();
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(setup({ hrOn: true, dismissedUntil: past }).el.querySelector('.onboarding-banner')).not.toBeNull();
  });

  it('shows the server message when skipping fails instead of resetting silently', () => {
    const { fixture, el, click, bypass$ } = setup({ hrOn: true });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', { onboarding: { bypassFailed: 'Could not skip paperwork: {{reason}}' } });
    translate.use('en');

    click('onboarding-skip-btn');
    click('onboarding-skip-confirm-btn');
    bypass$.error(new HttpErrorResponse({ status: 403, error: { detail: 'Not allowed' } }));
    fixture.detectChanges();

    expect(el.textContent).toContain('Could not skip paperwork: Not allowed');
    expect(el.querySelector('[data-testid="onboarding-skip-confirm-btn"]')).not.toBeNull();
  });
});
