import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

import { SsoCallbackComponent } from './sso-callback.component';
import { AuthService } from '../../shared/services/auth.service';
import { LayoutService } from '../../shared/services/layout.service';
import { SnackbarService } from '../../shared/services/snackbar.service';

describe('SsoCallbackComponent', () => {
  let router: { navigate: ReturnType<typeof vi.fn> };
  let snackbar: { error: ReturnType<typeof vi.fn>; errorFrom: ReturnType<typeof vi.fn> };

  function create(queryParams: Record<string, string>): SsoCallbackComponent {
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams } } },
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: { exchangeSsoCode: vi.fn() } },
        { provide: LayoutService, useValue: { getDefaultRoute: () => '/dashboard' } },
        { provide: SnackbarService, useValue: snackbar },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    return TestBed.runInInjectionContext(() => new SsoCallbackComponent());
  }

  beforeEach(() => {
    router = { navigate: vi.fn() };
    snackbar = { error: vi.fn(), errorFrom: vi.fn() };
  });

  it('explains an unverified identity-provider email and returns to the login page', () => {
    create({ error: 'email_unverified' }).ngOnInit();

    expect(snackbar.error).toHaveBeenCalledWith('auth.ssoEmailUnverified');
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
  });

  it('still reports an unknown account with its own message', () => {
    create({ error: 'no_account' }).ngOnInit();

    expect(snackbar.error).toHaveBeenCalledWith('auth.noAccountFound');
  });

  it('explains an identity-provider error it has no specific message for', () => {
    create({ error: 'access_denied' }).ngOnInit();

    expect(snackbar.error).toHaveBeenCalledWith('auth.ssoFailed');
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
  });

  it('explains a callback that came back with neither a code nor an error', () => {
    create({}).ngOnInit();

    expect(snackbar.error).toHaveBeenCalledWith('auth.ssoNoResponse');
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
  });
});
