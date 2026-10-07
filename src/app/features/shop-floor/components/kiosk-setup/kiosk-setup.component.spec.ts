import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { KioskSetupComponent } from './kiosk-setup.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { ShopFloorService } from '../../services/shop-floor.service';
import { KioskTerminal, Team } from '../../models/kiosk-terminal.model';

interface KioskSetupHarness {
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
  const auth = { login: vi.fn(() => of({})), clearAuth: vi.fn() };
  TestBed.configureTestingModule({
    imports: [KioskSetupComponent, TranslateModule.forRoot()],
    providers: [
      { provide: ShopFloorService, useValue: shopFloor },
      { provide: AuthService, useValue: auth },
    ],
  });
  const fixture = TestBed.createComponent(KioskSetupComponent);
  fixture.detectChanges();
  const component = fixture.componentInstance as unknown as KioskSetupHarness;
  const configured = vi.fn();
  fixture.componentInstance.configured.subscribe(configured);
  return { component, shopFloor, auth, configured };
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
});
