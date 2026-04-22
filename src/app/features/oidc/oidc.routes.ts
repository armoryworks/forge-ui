import { Routes } from '@angular/router';

export const OIDC_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./oidc-login-bridge.component').then(m => m.OidcLoginBridgeComponent),
  },
  {
    path: 'consent',
    loadComponent: () =>
      import('./oidc-consent.component').then(m => m.OidcConsentComponent),
  },
];
