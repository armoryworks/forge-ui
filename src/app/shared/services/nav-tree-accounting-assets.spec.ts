import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from './auth.service';
import { CapabilityService } from './capability.service';
import { NavTreeService } from './nav-tree.service';

function routesFor(roles: string[], enabled: (code: string) => boolean = () => true): string[] {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CapabilityService, useValue: { isEnabled: enabled } },
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some((r) => roles.includes(r)), user: () => null } },
    ],
  });
  return TestBed.inject(NavTreeService).flatLeaves().map((leaf) => leaf.route);
}

const SCREENS = ['/accounting/fixed-assets', '/accounting/journal-templates', '/accounting/overhead'];

describe('NavTreeService · fixed assets, journal templates and overhead', () => {
  it('lists all three for the Controller with the full ledger and depreciation on', () => {
    expect(routesFor(['Controller'])).toEqual(expect.arrayContaining(SCREENS));
  });

  it('drops fixed assets when depreciation is off', () => {
    const routes = routesFor(['Controller'], (code) => code !== 'CAP-ACCT-DEPRECIATION');

    expect(routes).not.toContain('/accounting/fixed-assets');
    expect(routes).toContain('/accounting/journal-templates');
  });

  it('drops all three when the full ledger is off', () => {
    const routes = routesFor(['Controller'], (code) => code !== 'CAP-ACCT-FULLGL');

    for (const route of SCREENS) expect(routes).not.toContain(route);
  });

  it('keeps them off the admin and manager menus', () => {
    for (const role of ['Admin', 'Manager']) {
      const routes = routesFor([role]);
      for (const route of SCREENS) expect(routes).not.toContain(route);
    }
  });
});
