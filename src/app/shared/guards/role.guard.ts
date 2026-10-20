import { inject } from '@angular/core';
import { CanActivateFn, RedirectCommand, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export function roleGuard(...allowedRoles: string[]): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.hasAnyRole(allowedRoles)) {
      return true;
    }

    return new RedirectCommand(router.parseUrl('/forbidden'), { browserUrl: state.url });
  };
}
