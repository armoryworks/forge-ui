import { CanActivateFn } from '@angular/router';

import { ROUTE_ACCESS } from '../models/route-access.model';
import { capabilityGuard } from './capability.guard';
import { roleGuard } from './role.guard';

/**
 * The `canActivate` guards for a gated top-level route, built from its {@link ROUTE_ACCESS} entry:
 * a {@link roleGuard} for its roles, then a {@link capabilityGuard} for its capabilities.
 */
export function routeAccessGuards(path: string): CanActivateFn[] {
  const access = ROUTE_ACCESS[path];
  if (!access) throw new Error(`No ROUTE_ACCESS entry for route '${path}'`);
  const guards: CanActivateFn[] = [];
  if (access.roles?.length) guards.push(roleGuard(...access.roles));
  if (access.capabilities?.length) guards.push(capabilityGuard(...access.capabilities));
  return guards;
}
