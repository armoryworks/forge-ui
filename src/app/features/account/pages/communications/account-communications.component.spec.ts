import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';

import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CommunicationSyncConfigSummary } from '../../models/communication-sync.model';
import { CommunicationsService } from '../../services/communications.service';
import { AccountCommunicationsComponent } from './account-communications.component';

interface KindGroupView {
  kind: string;
  healthyCount: number;
  available: { providerId: string }[];
}

describe('AccountCommunicationsComponent', () => {
  const configured = signal<ReadonlySet<string>>(new Set());
  const connections = signal<CommunicationSyncConfigSummary[]>([]);
  let component: AccountCommunicationsComponent;

  beforeEach(() => {
    configured.set(new Set());
    connections.set([]);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: CommunicationsService,
          useValue: {
            loading: signal(false),
            syncing: signal(new Set<number>()),
            connections,
            configuredOAuthProviders: configured,
            providers: [
              { providerId: 'imap', kind: 'Email', displayName: 'IMAP', description: '', icon: 'mail', status: 'available' },
              { providerId: 'gmail-oauth', kind: 'Email', displayName: 'Gmail', description: '', icon: 'mail', status: 'available' },
              { providerId: 'microsoft-oauth', kind: 'Email', displayName: 'Outlook', description: '', icon: 'mail', status: 'available' },
            ],
            loadConnections: vi.fn(),
            loadOAuthProviders: vi.fn(),
          },
        },
        { provide: CapabilityService, useValue: { isEnabled: () => true } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new AccountCommunicationsComponent());
  });

  const groups = () => (component as unknown as { kindGroups(): KindGroupView[] }).kindGroups();
  const emailProviders = () => groups().find(g => g.kind === 'Email')!.available.map(p => p.providerId);

  it('hides Gmail and Outlook sign-in until an admin configures OAuth', () => {
    expect(emailProviders()).not.toContain('gmail-oauth');
    expect(emailProviders()).not.toContain('microsoft-oauth');

    configured.set(new Set(['google']));

    expect(emailProviders()).toContain('gmail-oauth');
    expect(emailProviders()).not.toContain('microsoft-oauth');
  });

  it('does not count a pending mailbox as connected', () => {
    connections.set([{
      id: 1, userId: 5, kind: 'Email', providerId: 'mock-email', displayLabel: null, isConnected: false,
      externalAccountId: 'np@example.test', lastSyncedAt: null, lastError: null, lastErrorAt: null,
      createdAt: '', updatedAt: '',
    }]);

    expect(groups().find(g => g.kind === 'Email')!.healthyCount).toBe(0);
  });
});
