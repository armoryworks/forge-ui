import { describe, it, expect } from 'vitest';

import { AuthUser } from '../../shared/services/auth.service';
import { needsProfileCompletion } from './post-login.utils';

function user(roles: string[], profileComplete: boolean): AuthUser {
  return { id: 1, email: 'user@forge.local', firstName: 'Test', lastName: 'User', initials: 'TU', avatarColor: null, roles, profileComplete };
}

describe('needsProfileCompletion', () => {
  it('sends an employee with an incomplete profile to profile completion', () => {
    expect(needsProfileCompletion(user(['ProductionWorker'], false), 1440)).toBe(true);
  });

  it('lets Admin and Manager users land on the default route with an incomplete profile', () => {
    expect(needsProfileCompletion(user(['Admin'], false), 1440)).toBe(false);
    expect(needsProfileCompletion(user(['Engineer', 'Manager'], false), 1440)).toBe(false);
  });

  it('never redirects a complete profile, a missing user or a phone-width viewport', () => {
    expect(needsProfileCompletion(user(['Engineer'], true), 1440)).toBe(false);
    expect(needsProfileCompletion(null, 1440)).toBe(false);
    expect(needsProfileCompletion(undefined, 1440)).toBe(false);
    expect(needsProfileCompletion(user(['Engineer'], false), 768)).toBe(false);
  });
});
