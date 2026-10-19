import { inject } from '@angular/core';
import {
  CanActivateFn, NavigationCancel, NavigationCancellationCode, NavigationEnd, NavigationError, RedirectCommand, Router,
} from '@angular/router';
import { filter, take } from 'rxjs';

import { TranslateService } from '@ngx-translate/core';

import { AuthService } from '../services/auth.service';
import { SnackbarService } from '../services/snackbar.service';

/**
 * Route guard for a route whose last segment is a `:tab` param. A tab not in `validTabs` is replaced in
 * the URL by the default tab, with a notice once the page shows. A tab listed in `tabRoles` that none of
 * the user's roles may open shows the forbidden page while the address bar keeps the requested URL.
 * `defaultTab` may be a function when the default depends on the user.
 */
export function tabGuard(
  validTabs: readonly string[],
  defaultTab: string | (() => string),
  tabRoles: Readonly<Record<string, readonly string[]>> = {},
): CanActivateFn {
  return (route, state) => {
    const router = inject(Router);
    const tab = route.paramMap.get('tab') ?? '';

    if (validTabs.includes(tab)) {
      const roles = tabRoles[tab];
      if (!roles || inject(AuthService).hasAnyRole([...roles])) return true;
      return new RedirectCommand(router.parseUrl('/forbidden'), { browserUrl: state.url });
    }

    const fallback = typeof defaultTab === 'function' ? defaultTab() : defaultTab;
    const requested = router.parseUrl(state.url);
    const paths = requested.root.children['primary']?.segments.map((s) => s.path) ?? [];
    const target = router.createUrlTree(['/', ...paths.slice(0, -1), fallback], {
      queryParams: requested.queryParams,
      fragment: requested.fragment ?? undefined,
    });

    const snackbar = inject(SnackbarService);
    const message = inject(TranslateService).instant('routeStatus.unknownTab', { tab });
    router.events.pipe(
      filter((e) => e instanceof NavigationEnd || e instanceof NavigationError
        || (e instanceof NavigationCancel && e.code !== NavigationCancellationCode.Redirect)),
      take(1),
      filter((e) => e instanceof NavigationEnd),
    ).subscribe(() => snackbar.info(message));

    return new RedirectCommand(target, { replaceUrl: true });
  };
}
