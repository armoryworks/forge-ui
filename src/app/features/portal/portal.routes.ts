import { Routes } from '@angular/router';

import { portalAuthGuard } from './services/portal.guard';

export const PORTAL_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/portal-login.component').then(m => m.PortalLoginComponent),
  },
  {
    path: 'auth/callback',
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
        loadComponent: () => import('./pages/portal-dashboard.component').then(m => m.PortalDashboardComponent),
      },
      {
        path: 'orders',
        loadComponent: () => import('./pages/portal-orders.component').then(m => m.PortalOrdersComponent),
      },
      {
        path: 'quotes',
        loadComponent: () => import('./pages/portal-quotes.component').then(m => m.PortalQuotesComponent),
      },
      {
        path: 'invoices',
        loadComponent: () => import('./pages/portal-invoices.component').then(m => m.PortalInvoicesComponent),
      },
      {
        path: 'shipments',
        loadComponent: () => import('./pages/portal-shipments.component').then(m => m.PortalShipmentsComponent),
      },
    ],
  },
];
