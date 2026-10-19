import { describe, it, expect } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

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

@Component({ selector: 'app-nav-tree-spec-page', template: '' })
class SpecPageComponent {}

async function serviceAt(url: string): Promise<NavTreeService> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'notifications', data: { breadcrumb: 'header.notifications' }, children: [{ path: '', component: SpecPageComponent }] },
        { path: 'training/path/:id', component: SpecPageComponent },
        { path: 'customers/:id/:tab', component: SpecPageComponent },
        { path: 'customers', component: SpecPageComponent },
      ]),
      { provide: CapabilityService, useValue: { isEnabled: () => true } },
      { provide: AuthService, useValue: { hasAnyRole: () => true, user: () => null } },
    ],
  });
  const service = TestBed.inject(NavTreeService);
  await TestBed.inject(Router).navigateByUrl(url);
  return service;
}

describe('NavTreeService · breadcrumb', () => {
  it('names a page outside the navigation tree from its route data', async () => {
    const service = await serviceAt('/notifications');

    expect(service.breadcrumbTrail().map(c => c.i18nKey)).toEqual(['header.notifications']);
  });

  it('keeps Training as the current crumb on its module and path pages', async () => {
    const service = await serviceAt('/training/path/5');

    expect(service.breadcrumbTrail().at(-1)?.i18nKey).toBe('nav.training');
  });

  it('reports the record name only while the URL stays under that record', async () => {
    const service = await serviceAt('/customers/12/overview');
    service.setRecordCrumb('Acme Tooling', '/customers/12');
    expect(service.recordCrumb()).toBe('Acme Tooling');

    await TestBed.inject(Router).navigateByUrl('/customers/12/orders');
    expect(service.recordCrumb()).toBe('Acme Tooling');

    await TestBed.inject(Router).navigateByUrl('/customers');
    expect(service.recordCrumb()).toBeNull();
  });
});
