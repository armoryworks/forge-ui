import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';

import { environment } from '../../../environments/environment';
import { InstanceService } from '../services/instance.service';
import { authGuard } from './auth.guard';

/**
 * /app entry: a shared device carries no user session until a person
 * identifies for a transaction, so it passes on the device credential
 * alone; personal devices and the web preview go through authGuard.
 */
export const shellAuthGuard: CanActivateFn = (route, state) => {
  if (environment.mobileShell && inject(InstanceService).instance()?.shared) return true;
  return authGuard(route, state);
};
