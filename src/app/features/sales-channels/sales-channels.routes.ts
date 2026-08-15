import { Routes } from '@angular/router';

import { capabilityGuard } from '../../shared/guards/capability.guard';
import { SalesChannelsComponent } from './sales-channels.component';

/**
 * Sales channels and the retail lane.
 *
 * <p>Each sub-route carries its own capability guard rather than gating the
 * whole area at the parent: an install can run channels without retail (the
 * default, since CAP-O2C-CHANNELS ships on and is behaviour-neutral), retail
 * without marketplaces, or marketplaces without settlement reconciliation. The
 * guards mirror the server-side gates so a URL cannot reach a surface whose API
 * would 403.</p>
 *
 * <p>Literal sub-paths precede nothing dynamic here, but the bare path still
 * redirects so `/sales-channels` lands somewhere real.</p>
 */
export const SALES_CHANNELS_ROUTES: Routes = [
  { path: '', component: SalesChannelsComponent },
  {
    path: 'listings',
    canActivate: [capabilityGuard('CAP-EXT-ECOMMERCE')],
    loadComponent: () =>
      import('./pages/listings/channel-listings.component').then(
        (m) => m.ChannelListingsPageComponent,
      ),
  },
  {
    path: 'buyers',
    canActivate: [capabilityGuard('CAP-O2C-RETAIL')],
    loadComponent: () =>
      import('./pages/buyers/retail-buyers.component').then((m) => m.RetailBuyersPageComponent),
  },
  {
    path: 'settlements',
    canActivate: [capabilityGuard('CAP-O2C-SETTLEMENT')],
    loadComponent: () =>
      import('./pages/settlements/channel-settlements.component').then(
        (m) => m.ChannelSettlementsPageComponent,
      ),
  },
];
