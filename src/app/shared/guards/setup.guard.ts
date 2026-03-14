import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, catchError, of } from 'rxjs';

/** Redirects to /login if setup is already complete. */
export const setupRequiredGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.checkSetupStatus().pipe(
    map((status) =>
      status.setupRequired ? true : router.createUrlTree(['/login']),
    ),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};

/** Redirects to /setup if setup has not been completed yet. Allows authenticated users through so login page can prompt. */
export const setupCompleteGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // If already logged in, let the login component handle the prompt
  if (authService.isAuthenticated()) {
    return true;
  }

  return authService.checkSetupStatus().pipe(
    map((status) =>
      status.setupRequired ? router.createUrlTree(['/setup']) : true,
    ),
    catchError(() => of(true)),
  );
};
