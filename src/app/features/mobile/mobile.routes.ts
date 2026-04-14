import { Routes } from '@angular/router';

import { MobileLayoutComponent } from './mobile-layout.component';

export const MOBILE_ROUTES: Routes = [
  {
    path: '',
    component: MobileLayoutComponent,
    children: [
      { path: '', redirectTo: 'clock', pathMatch: 'full' },
      {
        path: 'jobs',
        loadComponent: () => import('./pages/mobile-jobs.component').then(m => m.MobileJobsComponent),
      },
      {
        path: 'jobs/:jobId',
        loadComponent: () => import('./pages/mobile-job-detail.component').then(m => m.MobileJobDetailComponent),
      },
      {
        path: 'clock',
        loadComponent: () => import('./pages/mobile-clock.component').then(m => m.MobileClockComponent),
      },
      {
        path: 'scan',
        loadComponent: () => import('./pages/mobile-scan.component').then(m => m.MobileScanComponent),
      },
      {
        path: 'time',
        loadComponent: () => import('./pages/mobile-hours.component').then(m => m.MobileHoursComponent),
      },
      {
        path: 'chat',
        loadComponent: () => import('./pages/mobile-chat.component').then(m => m.MobileChatComponent),
      },
      {
        path: 'notifications',
        loadComponent: () => import('./pages/mobile-notifications.component').then(m => m.MobileNotificationsComponent),
      },
      {
        path: 'account',
        loadComponent: () => import('./pages/mobile-account.component').then(m => m.MobileAccountComponent),
      },
    ],
  },
];
