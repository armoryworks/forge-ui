import { MobileAppScreen } from '../models/mobile-app-screen.model';

/** The phone's bottom-bar screens in tab order, each behind its own CAP-MOBILE-* flag. */
export const MOBILE_APP_SCREENS: readonly MobileAppScreen[] = [
  { path: '/app/scan', labelKey: 'mobileApp.tabs.scan', icon: 'qr_code_scanner', capability: 'CAP-MOBILE-SCAN' },
  { path: '/app/clock', labelKey: 'mobileApp.tabs.clock', icon: 'schedule', capability: 'CAP-MOBILE-CLOCK' },
  { path: '/app/jobs', labelKey: 'mobileApp.tabs.jobs', icon: 'work', capability: 'CAP-MOBILE-JOBS' },
  { path: '/app/move', labelKey: 'mobileApp.tabs.move', icon: 'swap_horiz', capability: 'CAP-MOBILE-STOCK' },
  { path: '/app/lookup', labelKey: 'mobileApp.tabs.lookup', icon: 'search', capability: 'CAP-MOBILE-LOOKUP' },
];
