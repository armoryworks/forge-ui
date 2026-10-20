import { describe, it, expect } from 'vitest';

import { AdminComponent } from './admin.component';

describe('AdminComponent.resolveTab', () => {
  it('lets an admin open an admin-only tab', () => {
    expect(AdminComponent.resolveTab('users', true, false)).toEqual({ tab: 'users', denied: false });
  });

  it('sends a non-admin away from an admin-only tab and flags it so the URL and a notice follow', () => {
    expect(AdminComponent.resolveTab('users', false, true)).toEqual({ tab: 'compliance', denied: true });
  });

  it('lets a manager open a manager tab but turns away a user with neither role', () => {
    expect(AdminComponent.resolveTab('training', false, true)).toEqual({ tab: 'training', denied: false });
    expect(AdminComponent.resolveTab('training', false, false)).toEqual({ tab: 'compliance', denied: true });
  });

  it('falls back to the role default for a missing or unknown tab without flagging a denial', () => {
    expect(AdminComponent.resolveTab(null, true, false)).toEqual({ tab: 'overview', denied: false });
    expect(AdminComponent.resolveTab('no-such-tab', false, true)).toEqual({ tab: 'compliance', denied: false });
  });
});
