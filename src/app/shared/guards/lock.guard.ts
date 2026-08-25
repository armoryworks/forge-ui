import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { LocalLockService } from '../services/local-lock.service';

/**
 * Native shell only: a device without a PIN goes to lock setup; a locked
 * device goes to the lock screen. Web builds pass through.
 */
export const lockGuard: CanActivateChildFn = () => {
  if (!environment.mobileShell) return true;

  const lock = inject(LocalLockService);
  const router = inject(Router);

  if (!lock.pinConfigured()) return router.parseUrl('/app/setup-lock');
  if (lock.locked()) return router.parseUrl('/app/lock');
  return true;
};
