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
        loadComponent: () => import('./pages/profile/account-profile.component').then(m => m.AccountProfileComponent),
      },
      {
        path: 'contact',
        loadComponent: () => import('./pages/contact/account-contact.component').then(m => m.AccountContactComponent),
      },
      {
        path: 'emergency',
        loadComponent: () => import('./pages/emergency/account-emergency.component').then(m => m.AccountEmergencyComponent),
      },
      {
        path: 'tax-forms',
        loadComponent: () => import('./pages/tax-forms/account-tax-forms.component').then(m => m.AccountTaxFormsComponent),
      },
      {
        path: 'tax-forms/:formType',
        loadComponent: () => import('./pages/tax-form-detail/account-tax-form-detail.component').then(m => m.AccountTaxFormDetailComponent),
      },
      {
        path: 'documents',
        loadComponent: () => import('./pages/documents/account-documents.component').then(m => m.AccountDocumentsComponent),
      },
      {
        path: 'pay-stubs',
        loadComponent: () => import('./pages/pay-stubs/account-pay-stubs.component').then(m => m.AccountPayStubsComponent),
      },
      {
        path: 'tax-documents',
        loadComponent: () => import('./pages/tax-documents/account-tax-documents.component').then(m => m.AccountTaxDocumentsComponent),
      },
      {
        path: 'security',
        loadComponent: () => import('./pages/security/account-security.component').then(m => m.AccountSecurityComponent),
      },
    ],
  },
];
