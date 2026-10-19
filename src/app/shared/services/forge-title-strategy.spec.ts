import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, Data, RouterStateSnapshot, convertToParamMap } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ForgeTitleStrategy } from './forge-title-strategy';
import { ThemeService } from './theme.service';

interface FakeRoute {
  data?: Data;
  params?: Record<string, string>;
}

function snapshot(url: string, ...chain: FakeRoute[]): RouterStateSnapshot {
  let child: ActivatedRouteSnapshot | null = null;
  for (const route of [...chain].reverse()) {
    child = {
      routeConfig: route.data ? { data: route.data } : {},
      paramMap: convertToParamMap(route.params ?? {}),
      firstChild: child,
    } as unknown as ActivatedRouteSnapshot;
  }
  const root = { routeConfig: null, paramMap: convertToParamMap({}), firstChild: child } as unknown as ActivatedRouteSnapshot;
  return { url, root } as RouterStateSnapshot;
}

describe('ForgeTitleStrategy', () => {
  let strategy: ForgeTitleStrategy;
  let translate: TranslateService;
  let theme: ThemeService;
  let title: Title;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      nav: { admin: 'Admin', invoices: 'Invoices', accounting: 'Accounting' },
      admin: { tabs: { users: 'Users', trackTypes: 'Order Types' } },
      accounting: { trialBalance: 'Trial Balance' },
      portal: { nav: { invoices: 'Invoices' }, companyPortal: '{{company}} customer portal' },
    });
    translate.setTranslation('es', {
      nav: { invoices: 'Facturas' },
    });
    translate.use('en');
    theme = TestBed.inject(ThemeService);
    title = TestBed.inject(Title);
    strategy = TestBed.inject(ForgeTitleStrategy);
  });

  afterEach(() => localStorage.clear());

  it('uses the deepest titleKey and the app name', () => {
    const state = snapshot('/accounting/trial-balance', { data: { titleKey: 'nav.accounting' } }, { data: { titleKey: 'accounting.trialBalance' } });
    strategy.updateTitle(state);
    expect(title.getTitle()).toBe('Trial Balance - Forge');
  });

  it('inherits the parent titleKey when the leaf has none', () => {
    strategy.updateTitle(snapshot('/invoices', { data: { titleKey: 'nav.invoices' } }, {}));
    expect(title.getTitle()).toBe('Invoices - Forge');
  });

  it('falls back to the app name alone when no route has a titleKey', () => {
    strategy.updateTitle(snapshot('/somewhere', {}));
    expect(title.getTitle()).toBe('Forge');
  });

  it('ignores a titleKey that has no translation', () => {
    strategy.updateTitle(snapshot('/x', { data: { titleKey: 'nav.missing' } }));
    expect(title.getTitle()).toBe('Forge');
  });

  it('names a tab route from its tab param, converting kebab-case', () => {
    const parent = { data: { titleKey: 'nav.admin' } };
    strategy.updateTitle(snapshot('/admin/users', parent, { data: { titleTabPrefix: 'admin.tabs.' }, params: { tab: 'users' } }));
    expect(title.getTitle()).toBe('Users - Forge');
    strategy.updateTitle(snapshot('/admin/track-types', parent, { data: { titleTabPrefix: 'admin.tabs.' }, params: { tab: 'track-types' } }));
    expect(title.getTitle()).toBe('Order Types - Forge');
  });

  it('keeps the feature title when the tab has no label', () => {
    strategy.updateTitle(snapshot('/admin/unknown', { data: { titleKey: 'nav.admin' } }, { data: { titleTabPrefix: 'admin.tabs.' }, params: { tab: 'unknown' } }));
    expect(title.getTitle()).toBe('Admin - Forge');
  });

  it('ends portal titles with the supplier portal name', () => {
    theme.companyName.set('Harbor Gear Works');
    strategy.updateTitle(snapshot('/portal/invoices', {}, { data: { titleKey: 'portal.nav.invoices' } }));
    expect(title.getTitle()).toBe('Invoices - Harbor Gear Works customer portal');
  });

  it('uses the app name for the portal when no company name is set', () => {
    strategy.updateTitle(snapshot('/portal/invoices', { data: { titleKey: 'portal.nav.invoices' } }));
    expect(title.getTitle()).toBe('Invoices - Forge customer portal');
  });

  it('does not treat other routes starting with portal as the customer portal', () => {
    strategy.updateTitle(snapshot('/portal-settings', { data: { titleKey: 'nav.invoices' } }));
    expect(title.getTitle()).toBe('Invoices - Forge');
  });

  it('re-titles when the language changes', () => {
    strategy.updateTitle(snapshot('/invoices', { data: { titleKey: 'nav.invoices' } }));
    translate.use('es');
    expect(title.getTitle()).toBe('Facturas - Forge');
  });

  it('re-titles when the brand app name changes', () => {
    strategy.updateTitle(snapshot('/invoices', { data: { titleKey: 'nav.invoices' } }));
    theme.appName.set('Shop OS');
    TestBed.tick();
    expect(title.getTitle()).toBe('Invoices - Shop OS');
  });
});
