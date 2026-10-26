import { MobileAppScreen } from '../models/mobile-app-screen.model';
import { AuthService } from '../services/auth.service';

/** Roles the pick-wave API admits, so the Pick tab shows only to people who can pick. */
export const PICK_ROLES: readonly string[] = ['Admin', 'Manager', 'OfficeManager', 'Engineer', 'ProductionWorker'];

/** The phone's bottom-bar screens in tab order, each behind its own flag (and, for Pick, the picking roles). */
export const MOBILE_APP_SCREENS: readonly MobileAppScreen[] = [
  { path: '/app/scan', labelKey: 'mobileApp.tabs.scan', icon: 'qr_code_scanner', capability: 'CAP-MOBILE-SCAN' },
  { path: '/app/clock', labelKey: 'mobileApp.tabs.clock', icon: 'schedule', capability: 'CAP-MOBILE-CLOCK' },
  { path: '/app/jobs', labelKey: 'mobileApp.tabs.jobs', icon: 'work', capability: 'CAP-MOBILE-JOBS' },
  { path: '/app/move', labelKey: 'mobileApp.tabs.move', icon: 'swap_horiz', capability: 'CAP-MOBILE-STOCK' },
  { path: '/app/lookup', labelKey: 'mobileApp.tabs.lookup', icon: 'search', capability: 'CAP-MOBILE-LOOKUP' },
  { path: '/app/picks', labelKey: 'mobileApp.tabs.picks', icon: 'inventory', capability: 'CAP-O2C-PICKPACK', roles: PICK_ROLES },
];

/**
 * Whether a screen is open to whoever holds the device: screens without roles always are; a role-limited one is
 * open to a matching role, and on a shared device with no one identified yet it stays open so the person can
 * identify there (the API checks the role once they have).
 */
export function screenOpenToViewer(screen: MobileAppScreen, auth: AuthService, sharedDevice: boolean): boolean {
  if (!screen.roles) return true;
  if (sharedDevice && !auth.isAuthenticated()) return true;
  return auth.hasAnyRole([...screen.roles]);
}
