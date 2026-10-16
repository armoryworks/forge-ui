import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from './auth.service';
import { CapabilityService } from './capability.service';
import { NavTreeService } from './nav-tree.service';

function routesFor(roles: string[]): string[] {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CapabilityService, useValue: { isEnabled: () => true } },
      { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)), user: () => null } },
    ],
  });
  return TestBed.inject(NavTreeService).flatLeaves().map(leaf => leaf.route);
}

describe('NavTreeService · purchasing and payables', () => {
  it('lists vendors, purchase orders, RFQs and payables for Procurement', () => {
    expect(routesFor(['Procurement'])).toEqual(expect.arrayContaining(['/vendors', '/purchase-orders', '/purchasing', '/payables']));
  });

  it('lists payables for the Controller without the purchasing screens', () => {
    const routes = routesFor(['Controller']);

    expect(routes).toContain('/payables');
    expect(routes).not.toContain('/vendors');
    expect(routes).not.toContain('/purchase-orders');
  });
});
