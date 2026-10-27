import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';

import { of } from 'rxjs';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AdminUser } from '../../models/admin-user.model';
import { AdminService } from '../../services/admin.service';
import { UserSetupInviteComponent } from './user-setup-invite.component';

interface InviteInternals {
  visible(): boolean;
  labelKey(): string;
  lastSentAt(): string | null;
  send(): void;
}

const user = (extra: Partial<AdminUser> = {}): AdminUser => ({
  id: 12, email: 'new.hire@example.test', firstName: 'New', lastName: 'Hire', initials: 'NH', avatarColor: null, isActive: true,
  roles: ['ProductionWorker'], createdAt: new Date(), hasPassword: false, hasPendingSetupToken: true, hasRfidIdentifier: false,
  hasBarcodeIdentifier: false, canBeAssignedJobs: false, complianceCompletedItems: 0, complianceTotalItems: 8, missingComplianceItems: [],
  workLocationId: null, workLocationName: null, i9Status: null, isNonEmployee: false, isServiceAccount: false, lastInviteSentAt: null,
  ...extra,
});

describe('UserSetupInviteComponent', () => {
  const admin = { sendSetupInvite: vi.fn() };

  function build(u: AdminUser): InviteInternals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: AdminService, useValue: admin },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      ],
    });
    const invite = TestBed.runInInjectionContext(() => new UserSetupInviteComponent()) as unknown as InviteInternals;
    Object.defineProperty(invite, 'user', { value: () => u });
    return invite;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    admin.sendSetupInvite.mockReturnValue(of(undefined));
  });

  it('offers a first invite to a user who has not finished setup', () => {
    const invite = build(user());

    expect(invite.visible()).toBe(true);
    expect(invite.labelKey()).toBe('admin.invite.send');
  });

  it('offers a resend and shows when the last invite went out', () => {
    const invite = build(user({ lastInviteSentAt: '2026-10-20T15:00:00Z' }));

    expect(invite.labelKey()).toBe('admin.invite.resend');
    expect(invite.lastSentAt()).toBe('2026-10-20T15:00:00Z');
  });

  it('is hidden once the user has a password, and for service and inactive accounts', () => {
    expect(build(user({ hasPassword: true })).visible()).toBe(false);
    expect(build(user({ isServiceAccount: true })).visible()).toBe(false);
    expect(build(user({ isActive: false })).visible()).toBe(false);
  });

  it('sends the invite for this app and records the send time', () => {
    const invite = build(user());

    invite.send();

    expect(admin.sendSetupInvite).toHaveBeenCalledWith(12, window.location.origin);
    expect(invite.lastSentAt()).not.toBeNull();
    expect(invite.labelKey()).toBe('admin.invite.resend');
  });
});
