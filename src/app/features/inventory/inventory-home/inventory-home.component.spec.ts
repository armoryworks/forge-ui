import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { BehaviorSubject, Observable, of } from 'rxjs';

import { AuthService } from '../../../shared/services/auth.service';
import { CapabilityService } from '../../../shared/services/capability.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { QuickAction } from '../../../shared/components/quick-action-panel/quick-action-panel.component';
import { InventoryService } from '../services/inventory.service';
import { InventoryHomeComponent } from './inventory-home.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface HomeInternals {
  canCount(): boolean;
  kioskActions(): QuickAction[];
  verbDialog(): { mode: string } | null;
  openVerb(mode: string): void;
}

function setup(roles: string[], enabledCapabilities: string[]) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: InventoryService, useValue: new Proxy({}, { get: () => () => of([]) }) },
      { provide: SnackbarService, useValue: { success: () => undefined, error: () => undefined } },
      { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
      { provide: ActivatedRoute, useValue: { paramMap: new BehaviorSubject(convertToParamMap({ tab: 'kiosk' })) } },
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      { provide: CapabilityService, useValue: { isEnabled: (code: string) => enabledCapabilities.includes(code) } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new InventoryHomeComponent());
  return component as unknown as HomeInternals;
}

const actionIds = (internals: HomeInternals) => internals.kioskActions().map(a => a.id);

describe('InventoryHomeComponent count verb', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('offers Count to a manager when stock adjustment is on', () => {
    const internals = setup(['Manager'], ['CAP-INV-ADJUST']);

    expect(internals.canCount()).toBe(true);
    expect(actionIds(internals)).toEqual(['receive', 'use', 'count', 'find']);
  });

  it('hides Count from roles the set-on-hand endpoint refuses', () => {
    for (const role of ['OfficeManager', 'Engineer', 'ProductionWorker']) {
      const internals = setup([role], ['CAP-INV-ADJUST']);

      expect(internals.canCount()).toBe(false);
      expect(actionIds(internals)).toEqual(['receive', 'use', 'find']);
    }
  });

  it('hides Count when stock adjustment is off', () => {
    const internals = setup(['Admin'], []);

    expect(actionIds(internals)).not.toContain('count');
  });

  it('does not open the count dialog for a role that cannot count', () => {
    const internals = setup(['OfficeManager'], ['CAP-INV-ADJUST']);

    internals.openVerb('count');

    expect(internals.verbDialog()).toBeNull();
  });
});
