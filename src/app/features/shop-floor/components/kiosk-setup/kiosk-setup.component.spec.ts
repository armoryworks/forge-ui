import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Component, input, output, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormControl } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';

import { KioskSetupComponent } from './kiosk-setup.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { ShopFloorService } from '../../services/shop-floor.service';
import { KioskTerminal, Team } from '../../models/kiosk-terminal.model';
import { MfaChallengeComponent } from '../../../auth/mfa-challenge.component';
import { MfaValidateResponse } from '../../../account/models/mfa.model';

@Component({ selector: 'app-mfa-challenge', standalone: true, template: '' })
class StubMfaChallengeComponent {
  readonly pendingToken = input.required<string>();
  readonly allowRememberDevice = input(true);
  readonly validated = output<MfaValidateResponse>();
  readonly cancelled = output<void>();
}

interface KioskSetupHarness {
  phase: WritableSignal<string>;
  loggingIn: WritableSignal<boolean>;
  noTeams(): boolean;
  teamsLoadFailed(): boolean;
  canActivate(): boolean;
  emailControl: FormControl<string | null>;
  passwordControl: FormControl<string | null>;
  saving: WritableSignal<boolean>;
  configError: WritableSignal<string | null>;
  showNewTeam: WritableSignal<boolean>;
  teamOptions: WritableSignal<{ value: unknown; label: string }[]>;
  terminalNameControl: FormControl<string | null>;
  teamControl: FormControl<number | null>;
  newTeamNameControl: FormControl<string | null>;
  onSave(): void;
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const terminal: KioskTerminal = {
  id: 7, name: 'Press 1', deviceToken: 'token', teamId: 3, teamName: 'Molding', teamColor: null,
};
const team: Team = { id: 3, name: 'Molding', color: null, description: null, memberCount: 0 };

function setup() {
  const shopFloor = {
    getTeams: vi.fn<ShopFloorService['getTeams']>(() => of([])),
    createTeam: vi.fn<ShopFloorService['createTeam']>(() => of(team)),
    setupTerminal: vi.fn<ShopFloorService['setupTerminal']>(() => of(terminal)),
  };
  const auth = {
    login: vi.fn<(c: unknown) => Observable<unknown>>(() => of({})),
    completeMfaLogin: vi.fn<(token: string, trusted?: string | null) => Observable<unknown>>(() => of({ id: 1 })),
    clearAuth: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [KioskSetupComponent, TranslateModule.forRoot()],
    providers: [
      { provide: ShopFloorService, useValue: shopFloor },
      { provide: AuthService, useValue: auth },
    ],
  }).overrideComponent(KioskSetupComponent, {
    remove: { imports: [MfaChallengeComponent] },
    add: { imports: [StubMfaChallengeComponent] },
  });
  const fixture = TestBed.createComponent(KioskSetupComponent);
  fixture.detectChanges();
  const component = fixture.componentInstance as unknown as KioskSetupHarness;
  const configured = vi.fn();
  fixture.componentInstance.configured.subscribe(configured);
  return { fixture, component, shopFloor, auth, configured };
}

function signIn(ctx: ReturnType<typeof setup>): void {
  ctx.component.emailControl.setValue('admin@forge.local');
  ctx.component.passwordControl.setValue('secret');
  const form = ctx.fixture.nativeElement.querySelector('[data-testid="kiosk-setup-login-form"]') as HTMLFormElement;
  form.dispatchEvent(new Event('submit', { cancelable: true }));
  ctx.fixture.detectChanges();
}

describe('KioskSetupComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('saves the terminal on a plain-HTTP origin where randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', { randomUUID: undefined, getRandomValues: crypto.getRandomValues.bind(crypto) });
    const { component, shopFloor, auth, configured } = setup();
    component.terminalNameControl.setValue('Press 1');
    component.teamControl.setValue(3);

    component.onSave();

    const token = shopFloor.setupTerminal.mock.calls[0][1];
    expect(token).toMatch(UUID_V4);
    expect(localStorage.getItem('forge-kiosk-device-token')).toBe(token);
    expect(auth.clearAuth).toHaveBeenCalled();
    expect(configured).toHaveBeenCalledWith(terminal);
    expect(component.saving()).toBe(false);
  });

  it('leaves the saving state and shows an error when the terminal save fails', () => {
    const { component, shopFloor, configured } = setup();
    shopFloor.setupTerminal.mockReturnValue(throwError(() => new Error('boom')));
    component.terminalNameControl.setValue('Press 1');
    component.teamControl.setValue(3);

    component.onSave();

    expect(component.saving()).toBe(false);
    expect(component.configError()).toBe('shopFloor.saveTerminalFailed');
    expect(configured).not.toHaveBeenCalled();
  });

  it('leaves the saving state when the device token cannot be produced', () => {
    const { component, shopFloor } = setup();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    component.terminalNameControl.setValue('Press 1');
    component.teamControl.setValue(3);

    component.onSave();

    expect(shopFloor.setupTerminal).not.toHaveBeenCalled();
    expect(component.saving()).toBe(false);
    expect(component.configError()).toBe('shopFloor.saveTerminalFailed');
  });

  it('keeps a newly created team selected so a retry does not create it again', () => {
    const { component, shopFloor } = setup();
    shopFloor.setupTerminal.mockReturnValueOnce(throwError(() => new Error('boom')));
    component.terminalNameControl.setValue('Press 1');
    component.showNewTeam.set(true);
    component.newTeamNameControl.setValue('Molding');

    component.onSave();

    expect(component.saving()).toBe(false);
    expect(component.showNewTeam()).toBe(false);
    expect(component.teamControl.value).toBe(3);
    expect(component.teamOptions().map(o => o.value)).toEqual([3]);

    component.onSave();

    expect(shopFloor.createTeam).toHaveBeenCalledTimes(1);
    expect(shopFloor.setupTerminal).toHaveBeenCalledTimes(2);
    expect(shopFloor.setupTerminal).toHaveBeenLastCalledWith('Press 1', expect.any(String), 3);
  });

  it('signs in when the admin form is submitted with Enter', () => {
    const ctx = setup();

    signIn(ctx);

    expect(ctx.auth.login).toHaveBeenCalledWith({ email: 'admin@forge.local', password: 'secret' });
    expect(ctx.component.phase()).toBe('configure');
  });

  it('ignores a sign-in submit while a field is empty or a sign-in is running', () => {
    const { component, auth } = setup();
    const submit = () => (component as unknown as { onLoginSubmit(): void }).onLoginSubmit();

    component.emailControl.setValue('admin@forge.local');
    submit();
    expect(auth.login).not.toHaveBeenCalled();

    component.passwordControl.setValue('secret');
    component.loggingIn.set(true);
    submit();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('asks for a new team name when the shop has no teams yet', () => {
    const ctx = setup();
    signIn(ctx);
    const { component, shopFloor, configured } = ctx;

    expect(component.noTeams()).toBe(true);
    expect(component.showNewTeam()).toBe(true);
    expect(ctx.fixture.nativeElement.querySelector('[data-testid="kiosk-setup-team"]')).toBeNull();
    expect(ctx.fixture.nativeElement.querySelector('[data-testid="kiosk-setup-no-teams"]')).not.toBeNull();
    expect(ctx.fixture.nativeElement.querySelector('[data-testid="kiosk-setup-existing-team-toggle"]')).toBeNull();

    component.terminalNameControl.setValue('Press 1');
    expect(component.canActivate()).toBe(false);
    component.newTeamNameControl.setValue('Molding');
    expect(component.canActivate()).toBe(true);

    component.onSave();

    expect(shopFloor.createTeam).toHaveBeenCalledWith('Molding');
    expect(shopFloor.setupTerminal).toHaveBeenCalledWith('Press 1', expect.any(String), 3);
    expect(configured).toHaveBeenCalledWith(terminal);
  });

  it('keeps activate disabled until an existing team is chosen', () => {
    const ctx = setup();
    ctx.shopFloor.getTeams.mockReturnValue(of([team]));
    signIn(ctx);
    const { component } = ctx;

    expect(component.noTeams()).toBe(false);
    expect(component.showNewTeam()).toBe(false);
    component.terminalNameControl.setValue('Press 1');
    expect(component.canActivate()).toBe(false);
    component.teamControl.setValue(3);
    expect(component.canActivate()).toBe(true);
  });

  it('shows an error when the teams cannot be loaded', () => {
    const ctx = setup();
    ctx.shopFloor.getTeams.mockReturnValue(throwError(() => new Error('boom')));
    signIn(ctx);

    expect(ctx.component.teamsLoadFailed()).toBe(true);
    expect(ctx.component.noTeams()).toBe(false);
    expect(ctx.fixture.nativeElement.querySelector('[data-testid="kiosk-setup-teams-error"]')).not.toBeNull();
  });

  const mfaChallenge = (ctx: ReturnType<typeof setup>): StubMfaChallengeComponent | null =>
    ctx.fixture.debugElement.query(By.directive(StubMfaChallengeComponent))?.componentInstance ?? null;

  it('asks an MFA admin for the code before loading teams', () => {
    const ctx = setup();
    ctx.auth.login.mockReturnValue(of({ mfaRequired: true, mfaPendingToken: 'pending-1' }));

    signIn(ctx);

    expect(ctx.component.phase()).toBe('mfa');
    expect(ctx.shopFloor.getTeams).not.toHaveBeenCalled();
    const challenge = mfaChallenge(ctx)!;
    expect(challenge.pendingToken()).toBe('pending-1');
    expect(challenge.allowRememberDevice()).toBe(false);
  });

  it('loads teams once the MFA code is verified, without trusting the kiosk as a device', () => {
    const ctx = setup();
    ctx.auth.login.mockReturnValue(of({ mfaRequired: true, mfaPendingToken: 'pending-1' }));
    signIn(ctx);

    mfaChallenge(ctx)!.validated.emit({
      accessToken: 'access', refreshToken: 'refresh', expiresAt: '2026-10-19T00:00:00Z', trustedDeviceToken: 'trusted',
    });
    ctx.fixture.detectChanges();

    expect(ctx.auth.completeMfaLogin).toHaveBeenCalledWith('access', null);
    expect(ctx.shopFloor.getTeams).toHaveBeenCalledTimes(1);
    expect(ctx.component.phase()).toBe('configure');
  });

  it('returns to the admin sign-in when the MFA challenge is cancelled', () => {
    const ctx = setup();
    ctx.auth.login.mockReturnValue(of({ mfaRequired: true, mfaPendingToken: 'pending-1' }));
    signIn(ctx);

    mfaChallenge(ctx)!.cancelled.emit();
    ctx.fixture.detectChanges();

    expect(ctx.component.phase()).toBe('admin-login');
    expect(ctx.shopFloor.getTeams).not.toHaveBeenCalled();
    expect(ctx.auth.completeMfaLogin).not.toHaveBeenCalled();
  });

  it('clears the half-finished sign-in when the profile cannot be loaded after MFA', () => {
    const ctx = setup();
    ctx.auth.login.mockReturnValue(of({ mfaRequired: true, mfaPendingToken: 'pending-1' }));
    ctx.auth.completeMfaLogin.mockReturnValue(throwError(() => new Error('boom')));
    signIn(ctx);

    mfaChallenge(ctx)!.validated.emit({ accessToken: 'access', refreshToken: 'r', expiresAt: '2026-10-19T00:00:00Z' });
    ctx.fixture.detectChanges();

    expect(ctx.auth.clearAuth).toHaveBeenCalled();
    expect(ctx.component.phase()).toBe('admin-login');
    expect(ctx.shopFloor.getTeams).not.toHaveBeenCalled();
  });

  it('offers the language switch on the sign-in card', () => {
    const ctx = setup();

    expect(ctx.fixture.nativeElement.querySelector('[data-testid="kiosk-setup-language-toggle"]')).not.toBeNull();
  });
});
