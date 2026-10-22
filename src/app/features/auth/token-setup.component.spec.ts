import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of, Subject, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { TokenSetupComponent } from './token-setup.component';
import { AuthService, AuthUser } from '../../shared/services/auth.service';
import { BrandingService } from '../../shared/services/branding.service';
import { LayoutService } from '../../shared/services/layout.service';
import { LoadingService } from '../../shared/services/loading.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ToastService } from '../../shared/services/toast.service';

interface TokenSetupHarness {
  onSubmit(): void;
  form: TokenSetupComponent['form'];
}

function user(roles: string[], profileComplete: boolean): AuthUser {
  return { id: 9, email: 'buyer@forge.local', firstName: 'Bo', lastName: 'Price', initials: 'BP', avatarColor: null, roles, profileComplete };
}

describe('TokenSetupComponent', () => {
  let router: { navigate: ReturnType<typeof vi.fn> };
  let completeSetup: ReturnType<typeof vi.fn>;
  let defaultRoute: string;

  beforeEach(() => {
    router = { navigate: vi.fn() };
    completeSetup = vi.fn();
    defaultRoute = '/dashboard';

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { completeSetup, validateSetupToken: vi.fn(() => of(null)) } },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ token: 'ABCD-EFGH' }) } } },
        { provide: LayoutService, useValue: { getDefaultRoute: () => defaultRoute } },
        { provide: LoadingService, useValue: { isLoading: () => false, track: <T>(_: string, source: Observable<T>) => source } },
        { provide: BrandingService, useValue: {} },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: ToastService, useValue: { show: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
  });

  function submitAs(roles: string[], profileComplete: boolean): void {
    completeSetup.mockReturnValue(of({ token: 't', expiresAt: '2026-10-17T00:00:00Z', user: user(roles, profileComplete) }));
    const setup = TestBed.runInInjectionContext(() => new TokenSetupComponent()) as unknown as TokenSetupHarness;
    setup.form.setValue({ password: 'Forge-Setup-2026!', confirmPassword: 'Forge-Setup-2026!' });
    setup.onSubmit();
  }

  it('lands a single-role user with an incomplete profile on the role landing page', () => {
    defaultRoute = '/purchasing';

    submitAs(['Procurement'], false);

    expect(completeSetup).toHaveBeenCalledWith({ token: 'ABCD-EFGH', password: 'Forge-Setup-2026!' });
    expect(router.navigate).toHaveBeenCalledWith(['/purchasing']);
  });

  it('never sends a freshly set-up user to the profile page', () => {
    defaultRoute = '/accounting';

    submitAs(['Controller'], false);

    expect(router.navigate).not.toHaveBeenCalledWith(['/account/profile']);
    expect(router.navigate).toHaveBeenCalledWith(['/accounting']);
  });

  function filledForm(): TokenSetupHarness {
    const setup = TestBed.runInInjectionContext(() => new TokenSetupComponent()) as unknown as TokenSetupHarness;
    setup.form.setValue({ password: 'Forge-Setup-2026!', confirmPassword: 'Forge-Setup-2026!' });
    return setup;
  }

  it('posts the setup once when Enter submits twice before the server answers', () => {
    completeSetup.mockReturnValue(new Subject());
    const setup = filledForm();

    setup.onSubmit();
    setup.onSubmit();

    expect(completeSetup).toHaveBeenCalledTimes(1);
  });

  it('lets the user retry after the server rejects the setup', () => {
    completeSetup.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { detail: 'nope' } })));
    const setup = filledForm();

    setup.onSubmit();
    setup.onSubmit();

    expect(completeSetup).toHaveBeenCalledTimes(2);
  });
});
