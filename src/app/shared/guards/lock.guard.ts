import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { InstanceService } from '../services/instance.service';
import { LocalLockService } from '../services/local-lock.service';

/**
 * Native shell only: a device without a PIN goes to lock setup; a locked
 * device goes to the lock screen. Web builds pass through.
 */
export const lockGuard: CanActivateChildFn = (_route, state) => {
  if (!environment.mobileShell) return true;

  if (inject(InstanceService).instance()?.shared) return true;

  const lock = inject(LocalLockService);
  const router = inject(Router);

  if (!lock.pinConfigured()) {
    lock.rememberReturnUrl(state.url);
    return router.parseUrl('/app/setup-lock');
  }
  if (lock.locked()) {
    lock.rememberReturnUrl(state.url);
    return router.parseUrl('/app/lock');
  }
  return true;
};
