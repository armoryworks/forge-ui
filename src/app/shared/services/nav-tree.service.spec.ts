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

describe('NavTreeService · assets', () => {
  it('lists assets for engineers, who maintain them', () => {
    expect(routesFor(['Engineer'])).toContain('/assets');
  });

  it('keeps assets off the office and shop-floor menus', () => {
    expect(routesFor(['OfficeManager'])).not.toContain('/assets');
    expect(routesFor(['ProductionWorker'])).not.toContain('/assets');
  });
});

describe('NavTreeService · maintenance', () => {
  it('opens preventive maintenance schedules from the Maintenance entry', () => {
    const routes = routesFor(['Manager'], code => code !== 'CAP-MAINT-PREDICTIVE');

    expect(routes).toContain('/maintenance/schedules');
    expect(routes).not.toContain('/maintenance/predictions');
  });

  it('lists predictions only when predictive maintenance is on', () => {
    const routes = routesFor(['Manager'], code => code !== 'CAP-MAINT-PM');

    expect(routes).toContain('/maintenance/predictions');
    expect(routes).not.toContain('/maintenance/schedules');
  });
});

describe('NavTreeService · admin pages', () => {
  it('lists working calendars, tariff rates and database transfer for an admin', () => {
    expect(routesFor(['Admin'])).toEqual(expect.arrayContaining(['/admin/working-calendars', '/admin/tariffs', '/admin/database']));
  });

  it('keeps those admin-only pages off a manager menu', () => {
    const routes = routesFor(['Manager']);

    expect(routes).not.toContain('/admin/working-calendars');
    expect(routes).not.toContain('/admin/database');
  });
});
