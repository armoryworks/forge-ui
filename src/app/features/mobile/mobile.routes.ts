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
        data: { titleKey: 'mobileLegacyPages.home.myJobs' },
        loadComponent: () => import('./pages/mobile-jobs.component').then(m => m.MobileJobsComponent),
      },
      {
        path: 'jobs/:jobId',
        data: { titleKey: 'mobileLegacyPages.home.myJobs' },
        loadComponent: () => import('./pages/mobile-job-detail.component').then(m => m.MobileJobDetailComponent),
      },
      {
        path: 'clock',
        data: { titleKey: 'mobileLegacyPages.home.clockInOut' },
        loadComponent: () => import('./pages/mobile-clock.component').then(m => m.MobileClockComponent),
      },
      {
        path: 'scan',
        data: { titleKey: 'mobileLegacyPages.scan.title' },
        loadComponent: () => import('./pages/mobile-scan.component').then(m => m.MobileScanComponent),
      },
      {
        path: 'time',
        data: { titleKey: 'mobileLegacyPages.home.myHours' },
        loadComponent: () => import('./pages/mobile-hours.component').then(m => m.MobileHoursComponent),
      },
      {
        path: 'chat',
        data: { titleKey: 'chat.title' },
        loadComponent: () => import('./pages/mobile-chat.component').then(m => m.MobileChatComponent),
      },
      {
        path: 'chat/channel-info/:channelId',
        data: { titleKey: 'mobileLegacyPages.channelInfo.title' },
        loadComponent: () => import('./pages/mobile-chat-channel-info/mobile-chat-channel-info.component').then(m => m.MobileChatChannelInfoComponent),
      },
      {
        path: 'notifications',
        data: { titleKey: 'notifications.title' },
        loadComponent: () => import('./pages/mobile-notifications.component').then(m => m.MobileNotificationsComponent),
      },
      {
        path: 'account',
        data: { titleKey: 'mobileLegacyPages.account.account' },
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () => import('./pages/mobile-account.component').then(m => m.MobileAccountComponent),
          },
          {
            path: '',
            loadComponent: () => import('./pages/mobile-account-section.component').then(m => m.MobileAccountSectionComponent),
            children: [
              {
                path: 'profile',
                data: { titleKey: 'account.profile' },
                loadComponent: () => import('../account/pages/profile/account-profile.component').then(m => m.AccountProfileComponent),
              },
              {
                path: 'security',
                data: { titleKey: 'account.security' },
                loadComponent: () => import('../account/pages/security/account-security.component').then(m => m.AccountSecurityComponent),
              },
              {
                path: 'customization',
                data: { titleKey: 'account.customization' },
                loadComponent: () => import('../account/pages/customization/account-customization.component').then(m => m.AccountCustomizationComponent),
              },
              {
                path: 'integrations',
                data: { titleKey: 'admin.tabs.integrations' },
                loadComponent: () => import('../account/pages/integrations/account-integrations.component').then(m => m.AccountIntegrationsComponent),
              },
            ],
          },
        ],
      },
    ],
  },
];
