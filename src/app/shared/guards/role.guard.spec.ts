import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RedirectCommand, Router, RouterStateSnapshot } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { roleGuard } from './role.guard';

describe('roleGuard', () => {
  const hasAnyRole = vi.fn<(roles: string[]) => boolean>();

  beforeEach(() => {
    hasAnyRole.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { hasAnyRole } }],
    });
  });

  const run = (): unknown =>
    TestBed.runInInjectionContext(() =>
      roleGuard('Admin', 'Manager')({} as ActivatedRouteSnapshot, { url: '/leads?detail=lead:4' } as RouterStateSnapshot));

  it('lets a user with one of the roles in', () => {
    hasAnyRole.mockReturnValue(true);
    expect(run()).toBe(true);
    expect(hasAnyRole).toHaveBeenCalledWith(['Admin', 'Manager']);
  });

  it('shows the forbidden page while the address bar keeps the requested URL', () => {
    hasAnyRole.mockReturnValue(false);
    const result = run();
    expect(result).toBeInstanceOf(RedirectCommand);
    const command = result as RedirectCommand;
    expect(TestBed.inject(Router).serializeUrl(command.redirectTo)).toBe('/forbidden');
    expect(command.navigationBehaviorOptions?.browserUrl).toBe('/leads?detail=lead:4');
  });
});
