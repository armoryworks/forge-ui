import { AuthUser } from '../../shared/services/auth.service';

const MOBILE_MAX_WIDTH = 768;
const PROFILE_PROMPT_EXEMPT_ROLES = ['Admin', 'Manager'];

export function needsProfileCompletion(user: AuthUser | null | undefined, viewportWidth: number): boolean {
  if (!user || user.profileComplete) return false;
  if (viewportWidth <= MOBILE_MAX_WIDTH) return false;
  return !user.roles.some(role => PROFILE_PROMPT_EXEMPT_ROLES.includes(role));
}
