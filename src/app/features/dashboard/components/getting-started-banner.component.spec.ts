import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';

import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';

import { CapabilityService } from '../../../shared/services/capability.service';
import { UserPreferencesService } from '../../../shared/services/user-preferences.service';
import { DashboardData } from '../models/dashboard-data.model';
import { GettingStartedBannerComponent } from './getting-started-banner.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

const JOB_SHOP_CAPABILITIES = [
  'CAP-MD-WORKCENTERS', 'CAP-MD-CUSTOMERS', 'CAP-MD-ROUTING',
  'CAP-O2C-QUOTE', 'CAP-EXT-KANBAN', 'CAP-O2C-SHIP',
];

function data(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    tasks: [],
    stages: [],
    team: [],
    activity: [],
    deadlines: [],
    kpis: {} as DashboardData['kpis'],
    customerCount: 0,
    trackTypeCount: 3,
    workCenterCount: 0,
    partsWithOperationsCount: 0,
    quoteCount: 0,
    shipmentCount: 0,
    totalJobCount: 0,
    ...overrides,
  };
}

const EVERYTHING_EXISTS: Partial<DashboardData> = {
  workCenterCount: 2,
  customerCount: 1,
  partsWithOperationsCount: 1,
  quoteCount: 1,
  totalJobCount: 1,
  shipmentCount: 1,
};

describe('GettingStartedBannerComponent', () => {
  let fixture: ComponentFixture<GettingStartedBannerComponent>;
  let enabled: Set<string>;

  function render(d: DashboardData): void {
    fixture = TestBed.createComponent(GettingStartedBannerComponent);
    fixture.componentRef.setInput('data', d);
    fixture.detectChanges();
  }

  function stepLabels(): string[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.getting-started__step-label'))
      .map(e => e.textContent?.trim() ?? '');
  }

  function doneCount(): number {
    return (fixture.nativeElement as HTMLElement).querySelectorAll('.getting-started__step--done').length;
  }

  function bannerShown(): boolean {
    return !!(fixture.nativeElement as HTMLElement).querySelector('.getting-started');
  }

  beforeEach(() => {
    enabled = new Set(JOB_SHOP_CAPABILITIES);
    TestBed.configureTestingModule({
      imports: [GettingStartedBannerComponent],
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => enabled.has(code) } },
        { provide: UserPreferencesService, useValue: { get: () => null, set: () => undefined } },
      ],
    });
  });

  it('lists the six job-shop steps in order', () => {
    render(data());

    expect(stepLabels()).toEqual([
      'dashboard.addWorkCenters',
      'dashboard.addCustomer',
      'dashboard.addFirstPart',
      'dashboard.sendFirstQuote',
      'dashboard.createFirstJob',
      'dashboard.shipFirstOrder',
    ]);
  });

  it('marks each step done from its own count', () => {
    render(data({ workCenterCount: 1, quoteCount: 2 }));

    expect(doneCount()).toBe(2);
    expect(bannerShown()).toBe(true);
  });

  it('counts any job ever created, not just active ones', () => {
    render(data({ totalJobCount: 1, kpis: { activeCount: 0 } as DashboardData['kpis'] }));

    expect(doneCount()).toBe(1);
  });

  it('completes once work center, customer, part, quote, job and shipment exist', () => {
    render(data(EVERYTHING_EXISTS));

    expect(bannerShown()).toBe(false);
  });

  it('stays up until every visible step is done', () => {
    render(data({ ...EVERYTHING_EXISTS, shipmentCount: 0 }));

    expect(bannerShown()).toBe(true);
  });

  it('hides steps for modules that are off', () => {
    enabled = new Set(['CAP-MD-CUSTOMERS', 'CAP-O2C-QUOTE']);
    render(data());

    expect(stepLabels()).toEqual(['dashboard.addCustomer', 'dashboard.sendFirstQuote']);
  });

  it('completes on the visible steps alone', () => {
    enabled = new Set(['CAP-MD-CUSTOMERS', 'CAP-O2C-QUOTE']);
    render(data({ customerCount: 1, quoteCount: 1 }));

    expect(bannerShown()).toBe(false);
  });

  it('does not ask about track types', () => {
    render(data({ trackTypeCount: 3 }));

    expect(stepLabels()).not.toContain('dashboard.setUpTrackTypes');
  });
});
