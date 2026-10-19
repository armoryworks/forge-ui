import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LayoutService } from '../../services/layout.service';
import { RouteStatusPageComponent } from './route-status-page.component';

describe('RouteStatusPageComponent', () => {
  const navigateByUrl = vi.fn();
  let home: string;

  function render(status: string | undefined, path: string) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [RouteStatusPageComponent, TranslateModule.forRoot()],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { data: status ? { status } : {} } } },
        { provide: Router, useValue: { navigateByUrl } },
        { provide: Location, useValue: { path: () => path } },
        { provide: LayoutService, useValue: { getDefaultRoute: () => home } },
      ],
    });
    const fixture = TestBed.createComponent(RouteStatusPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return {
      icon: el.querySelector('.empty-state__icon')?.textContent?.trim(),
      message: el.querySelector('.empty-state__message')?.textContent?.trim(),
      button: el.querySelector('button') as HTMLButtonElement,
    };
  }

  beforeEach(() => {
    navigateByUrl.mockReset();
    home = '/kanban';
  });

  it('says the page was not found by default', () => {
    const { icon, message } = render(undefined, '/no-such-page');
    expect(icon).toBe('search_off');
    expect(message).toBe('routeStatus.notFound');
  });

  it('says access is denied for a forbidden route', () => {
    const { icon, message } = render('forbidden', '/leads');
    expect(icon).toBe('lock');
    expect(message).toBe('routeStatus.forbidden');
  });

  it('says the feature is off for a capability-gated route', () => {
    expect(render('featureOff', '/accounting').message).toBe('routeStatus.featureOff');
  });

  it('goes to the user home screen', () => {
    render('forbidden', '/leads').button.click();
    expect(navigateByUrl).toHaveBeenCalledWith('/kanban');
  });

  it('goes to the dashboard when home is the page that was refused, so it cannot loop', () => {
    home = '/accounting';
    render('featureOff', '/accounting/ledger?x=1').button.click();
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });
});
