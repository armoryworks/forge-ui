import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ElementRef, WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { LoginComponent } from './login.component';
import { AuthService, AuthUser, LoginResponse } from '../../shared/services/auth.service';
import { BrandingService } from '../../shared/services/branding.service';
import { LayoutService } from '../../shared/services/layout.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ToastService } from '../../shared/services/toast.service';

interface LoginHarness {
  onSubmit(): void;
  form: LoginComponent['form'];
}

function user(roles: string[], profileComplete: boolean): AuthUser {
  return { id: 7, email: 'admin@forge.local', firstName: 'Ada', lastName: 'Admin', initials: 'AA', avatarColor: null, roles, profileComplete };
}

describe('LoginComponent', () => {
  let host: HTMLElement;
  let auth: { isAuthenticated: WritableSignal<boolean>; user: WritableSignal<AuthUser | null>; login: ReturnType<typeof vi.fn>; getSsoProviders: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn>; navigateByUrl: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    host = document.createElement('div');
    host.innerHTML = `
      <app-input data-testid="login-email"><input type="email"></app-input>
      <app-input data-testid="login-password"><input type="password"></app-input>`;
    auth = {
      isAuthenticated: signal(false),
      user: signal<AuthUser | null>(null),
      login: vi.fn(),
      getSsoProviders: vi.fn(() => of([])),
    };
    router = { navigate: vi.fn(), navigateByUrl: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: ElementRef, useValue: new ElementRef(host) },
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
        { provide: LayoutService, useValue: { getDefaultRoute: () => '/dashboard' } },
        { provide: BrandingService, useValue: {} },
        { provide: SnackbarService, useValue: { error: vi.fn(), info: vi.fn() } },
        { provide: ToastService, useValue: { show: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
  });

  function create(): LoginHarness {
    return TestBed.runInInjectionContext(() => new LoginComponent()) as unknown as LoginHarness;
  }

  function autofill(email: string, password: string): void {
    host.querySelector<HTMLInputElement>('[data-testid="login-email"] input')!.value = email;
    host.querySelector<HTMLInputElement>('[data-testid="login-password"] input')!.value = password;
  }

  function respond(response: Partial<LoginResponse>): void {
    auth.login.mockReturnValue(of({ token: 't', expiresAt: '2026-10-09T00:00:00Z', ...response }));
  }

  it('signs in with browser-autofilled fields the form never saw typed', () => {
    respond({ user: user(['Engineer'], true) });
    const login = create();
    autofill('admin@forge.local', 'correct horse');

    login.onSubmit();

    expect(auth.login).toHaveBeenCalledWith({ email: 'admin@forge.local', password: 'correct horse' });
  });

  it('validates on submit instead of sending an empty form', () => {
    const login = create();

    login.onSubmit();

    expect(auth.login).not.toHaveBeenCalled();
    expect(login.form.touched).toBe(true);
  });

  it('lands an admin with an incomplete employee profile on the default route', () => {
    respond({ user: user(['Admin'], false) });
    const login = create();
    autofill('admin@forge.local', 'correct horse');

    login.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('still sends other roles with an incomplete profile to profile completion', () => {
    respond({ user: user(['ProductionWorker'], false) });
    const login = create();
    autofill('worker@forge.local', 'correct horse');

    login.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/account/profile']);
  });
});
