import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { AuthService } from '../../../shared/services/auth.service';
import { DesktopPreferenceService } from '../../../shared/services/desktop-preference.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { ThemeService } from '../../../shared/services/theme.service';
import { MOBILE_ROUTES } from '../mobile.routes';
import { MobileAccountComponent } from './mobile-account.component';

describe('MobileAccountComponent', () => {
  let fixture: ComponentFixture<MobileAccountComponent>;
  const prefer = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [MobileAccountComponent],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: AuthService, useValue: { user: signal({ id: 1, firstName: 'Ada', lastName: 'Lovelace', email: 'a@example.com' }), logout: vi.fn() } },
        { provide: ThemeService, useValue: { theme: signal('light'), toggle: vi.fn() } },
        { provide: DesktopPreferenceService, useValue: { prefer } },
        { provide: SnackbarService, useValue: { error: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MobileAccountComponent);
    fixture.detectChanges();
  });

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('keeps the account pages inside the mobile shell', () => {
    for (const page of ['profile', 'security', 'customization', 'integrations']) {
      expect(el().querySelector(`[data-testid="maccount-${page}-link"]`)!.getAttribute('href')).toBe(`/m/account/${page}`);
    }
  });

  it('registers each linked account page under /m/account', () => {
    const account = MOBILE_ROUTES[0].children!.find(r => r.path === 'account')!;
    const section = account.children!.find(r => r.path === '' && r.children)!;
    expect(section.children!.map(r => r.path)).toEqual(['profile', 'security', 'customization', 'integrations']);
  });

  it('opens the setup wizard on the desktop site', () => {
    prefer.mockReturnValue(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    el().querySelector<HTMLButtonElement>('[data-testid="maccount-setup-wizard-btn"]')!.click();

    expect(prefer).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/onboarding'], { queryParams: undefined });
  });
});
