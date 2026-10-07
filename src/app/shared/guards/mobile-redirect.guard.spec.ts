import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';

import { LayoutService } from '../services/layout.service';
import { mobileRedirectGuard } from './mobile-redirect.guard';

describe('mobileRedirectGuard', () => {
  const isMobileDevice = vi.fn<() => boolean>();

  beforeEach(() => {
    isMobileDevice.mockReset();
    isMobileDevice.mockReturnValue(true);
    localStorage.removeItem('preferDesktop');
    TestBed.configureTestingModule({
      providers: [{ provide: LayoutService, useValue: { isMobileDevice } }],
    });
  });

  afterEach(() => {
    localStorage.removeItem('preferDesktop');
    vi.restoreAllMocks();
  });

  const run = (url: string): boolean | UrlTree =>
    TestBed.runInInjectionContext(() =>
      mobileRedirectGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot)) as boolean | UrlTree;

  const target = (url: string): string => {
    const result = run(url);
    expect(result).toBeInstanceOf(UrlTree);
    return TestBed.inject(Router).serializeUrl(result as UrlTree);
  };

  it('lets desktop devices through', () => {
    isMobileDevice.mockReturnValue(false);
    expect(run('/kanban')).toBe(true);
  });

  it('maps a job route to the mobile job page', () => {
    expect(target('/jobs/42')).toBe('/m/jobs/42');
  });

  it('maps a kanban job detail link to the mobile job page', () => {
    expect(target('/kanban?detail=job:5')).toBe('/m/jobs/5');
  });

  it('sends a kanban link without a job detail to /m with the original url', () => {
    expect(target('/kanban?detail=part:5')).toBe('/m?returnUrl=%2Fkanban%3Fdetail%3Dpart:5');
  });

  it('sends any other route to /m carrying returnUrl', () => {
    const tree = run('/parts/7?tab=bom') as UrlTree;
    expect(tree.toString().startsWith('/m?')).toBe(true);
    expect(tree.queryParams['returnUrl']).toBe('/parts/7?tab=bom');
  });

  it('does not treat a non-numeric job segment as a job id', () => {
    const tree = run('/jobs/new') as UrlTree;
    expect(tree.queryParams['returnUrl']).toBe('/jobs/new');
  });

  it('keeps exempt desktop routes', () => {
    expect(run('/account/profile')).toBe(true);
  });

  it('honours a stored desktop preference', () => {
    localStorage.setItem('preferDesktop', 'true');
    expect(run('/jobs/42')).toBe(true);
  });

  it('still redirects when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(target('/jobs/42')).toBe('/m/jobs/42');
  });
});
