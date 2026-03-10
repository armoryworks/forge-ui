import { Routes } from '@angular/router';

import { ShopFloorDisplayComponent } from './shop-floor-display.component';

export const SHOP_FLOOR_ROUTES: Routes = [
  { path: '', component: ShopFloorDisplayComponent },
  {
    path: 'clock',
    loadComponent: () =>
      import('./clock/shop-floor-clock.component').then((m) => m.ShopFloorClockComponent),
  },
];
