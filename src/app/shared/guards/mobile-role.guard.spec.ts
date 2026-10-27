import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { InstanceService } from '../services/instance.service';
import { mobileRoleGuard } from './mobile-role.guard';

describe('mobileRoleGuard', () => {
  let roles: string[];
  let authenticated: boolean;
  let shared: boolean;

  beforeEach(() => {
    roles = [];
    authenticated = true;
    shared = false;
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { hasAnyRole: (allowed: string[]) => allowed.some((r) => roles.includes(r)), isAuthenticated: () => authenticated } },
        { provide: InstanceService, useValue: { instance: () => ({ id: 'shop', shared }) } },
      ],
    });
  });

  const run = (): boolean | UrlTree =>
    TestBed.runInInjectionContext(() =>
      mobileRoleGuard('/app/picks')({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as boolean | UrlTree;

  it('lets a picking role open Pick', () => {
    roles = ['ProductionWorker'];
    expect(run()).toBe(true);
  });

  it('sends any other role to Account', () => {
    roles = ['PM'];
    const result = run();
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/app/account');
  });

  it('keeps Pick open on a shared device before anyone has identified', () => {
    shared = true;
    authenticated = false;
    expect(run()).toBe(true);
  });
});
