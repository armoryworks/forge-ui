import { inject } from '@angular/core';
import { CanActivateFn, RedirectCommand, Router } from '@angular/router';
import { map } from 'rxjs';
import { CapabilityService } from '../services/capability.service';

/**
 * Route guard that allows activation when AT LEAST ONE of the given capability codes is enabled, the route-side
 * twin of the API's `[RequiresAnyCapability]`. Otherwise shows the feature-off page while the address bar keeps
 * the requested URL. Waits for the live descriptor on a cold deep link, like {@link capabilityGuard}.
 */
export function anyCapabilityGuard(...anyOf: string[]): CanActivateFn {
  return (_route, state) => {
    const capabilities = inject(CapabilityService);
    const router = inject(Router);

    const decide = (): boolean | RedirectCommand =>
      anyOf.some((code) => capabilities.isEnabled(code))
        ? true
        : new RedirectCommand(router.parseUrl('/feature-off'), { browserUrl: state.url });

    if (capabilities.descriptor() !== null) {
      return decide();
    }

    return capabilities.load().pipe(map(decide));
  };
}
