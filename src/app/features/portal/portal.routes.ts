import { Routes } from '@angular/router';

import { portalAuthGuard } from './services/portal.guard';

export const PORTAL_ROUTES: Routes = [
  {
    path: 'login',
    data: { titleKey: 'routeTitles.login' },
    loadComponent: () => import('./pages/portal-login.component').then(m => m.PortalLoginComponent),
  },
  {
    path: 'auth/callback',
    data: { titleKey: 'routeTitles.ssoCallback' },
    loadComponent: () => import('./pages/portal-auth-callback.component').then(m => m.PortalAuthCallbackComponent),
  },
  {
    path: '',
    loadComponent: () => import('./portal-layout.component').then(m => m.PortalLayoutComponent),
    canActivate: [portalAuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        data: { titleKey: 'portal.nav.dashboard' },
        loadComponent: () => import('./pages/portal-dashboard.component').then(m => m.PortalDashboardComponent),
      },
      {
        path: 'orders',
        data: { titleKey: 'portal.nav.orders' },
        loadComponent: () => import('./pages/portal-orders.component').then(m => m.PortalOrdersComponent),
      },
      {
        path: 'quotes',
        data: { titleKey: 'portal.nav.quotes' },
        loadComponent: () => import('./pages/portal-quotes.component').then(m => m.PortalQuotesComponent),
      },
      {
        path: 'invoices',
        data: { titleKey: 'portal.nav.invoices' },
        loadComponent: () => import('./pages/portal-invoices.component').then(m => m.PortalInvoicesComponent),
      },
      {
        path: 'shipments',
        data: { titleKey: 'portal.nav.shipments' },
        loadComponent: () => import('./pages/portal-shipments.component').then(m => m.PortalShipmentsComponent),
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
