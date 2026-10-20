import { Routes } from '@angular/router';

import { AccountLayoutComponent } from './account-layout.component';

export const ACCOUNT_ROUTES: Routes = [
  {
    path: '',
    component: AccountLayoutComponent,
    children: [
      { path: '', redirectTo: 'profile', pathMatch: 'full' },
      {
        path: 'profile',
        data: { titleKey: 'account.profile' },
        loadComponent: () => import('./pages/profile/account-profile.component').then(m => m.AccountProfileComponent),
      },
      {
        path: 'contact',
        data: { titleKey: 'account.contact' },
        loadComponent: () => import('./pages/contact/account-contact.component').then(m => m.AccountContactComponent),
      },
      {
        path: 'emergency',
        data: { titleKey: 'account.emergency' },
        loadComponent: () => import('./pages/emergency/account-emergency.component').then(m => m.AccountEmergencyComponent),
      },
      {
        path: 'tax-forms',
        data: { titleKey: 'account.taxForms' },
        loadComponent: () => import('./pages/tax-forms/account-tax-forms.component').then(m => m.AccountTaxFormsComponent),
      },
      {
        path: 'tax-forms/:formType',
        data: { titleKey: 'account.taxForms' },
        loadComponent: () => import('./pages/tax-form-detail/account-tax-form-detail.component').then(m => m.AccountTaxFormDetailComponent),
      },
      {
        path: 'documents',
        data: { titleKey: 'account.documents' },
        loadComponent: () => import('./pages/documents/account-documents.component').then(m => m.AccountDocumentsComponent),
      },
      {
        path: 'pay-stubs',
        data: { titleKey: 'account.payStubs' },
        loadComponent: () => import('./pages/pay-stubs/account-pay-stubs.component').then(m => m.AccountPayStubsComponent),
      },
      {
        path: 'tax-documents',
        data: { titleKey: 'account.taxDocuments' },
        loadComponent: () => import('./pages/tax-documents/account-tax-documents.component').then(m => m.AccountTaxDocumentsComponent),
      },
      {
        path: 'security',
        data: { titleKey: 'account.security' },
        loadComponent: () => import('./pages/security/account-security.component').then(m => m.AccountSecurityComponent),
      },
      {
        path: 'customization',
        data: { titleKey: 'account.customization' },
        loadComponent: () => import('./pages/customization/account-customization.component').then(m => m.AccountCustomizationComponent),
      },
      {
        path: 'integrations',
        data: { titleKey: 'admin.tabs.integrations' },
        loadComponent: () => import('./pages/integrations/account-integrations.component').then(m => m.AccountIntegrationsComponent),
      },
      {
        path: 'communications',
        data: { titleKey: 'account.communications.title' },
        loadComponent: () => import('./pages/communications/account-communications.component').then(m => m.AccountCommunicationsComponent),
      },
      {
        // Phase 1k.2 — OAuth-IMAP redirect-back. Registered with Google
        // + Microsoft as the authorized redirect URI; provider posts
        // ?code= + ?state= here.
        path: 'communications/oauth-callback',
        data: { titleKey: 'account.communications.title' },
        loadComponent: () => import('./pages/communications/oauth-callback.component').then(m => m.OauthCallbackComponent),
      },
    ],
  },
];
