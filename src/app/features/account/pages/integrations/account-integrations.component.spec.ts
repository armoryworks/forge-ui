import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { UserIntegrationService } from '../../services/user-integration.service';
import { UserIntegrationSummary } from '../../models/user-integration.model';
import { AccountIntegrationsComponent } from './account-integrations.component';

describe('AccountIntegrationsComponent', () => {
  const snackbar = { success: vi.fn(), info: vi.fn(), error: vi.fn(), errorFrom: vi.fn() };
  let testResult: { success: boolean; contacted: boolean };
  let component: AccountIntegrationsComponent;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: UserIntegrationService,
          useValue: {
            loading: signal(false),
            integrations: signal([]),
            providers: signal([{ providerId: 's3', category: 'storage', displayName: 'S3', authType: 'access_key', description: '', icon: 'cloud' }]),
            loadIntegrations: vi.fn(),
            loadProviders: vi.fn(),
            testConnection: () => of(testResult),
          },
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: SnackbarService, useValue: snackbar },
      ],
    });
    component = TestBed.runInInjectionContext(() => new AccountIntegrationsComponent());
  });

  const summary = { id: 3, providerId: 's3' } as UserIntegrationSummary;

  it('does not claim a passed test when the provider was never contacted', () => {
    testResult = { success: true, contacted: false };

    (component as unknown as { testConnection(i: UserIntegrationSummary): void }).testConnection(summary);

    expect(snackbar.success).not.toHaveBeenCalled();
    expect(snackbar.info).toHaveBeenCalled();
  });

  it('reports a passed test when the provider answered', () => {
    testResult = { success: true, contacted: true };

    (component as unknown as { testConnection(i: UserIntegrationSummary): void }).testConnection(summary);

    expect(snackbar.success).toHaveBeenCalledWith('Connection test passed');
  });

  it('hides categories that have nothing connected and nothing to offer', () => {
    const categories = (component as unknown as { categoryGroups(): { category: string }[] }).categoryGroups();

    expect(categories.map(g => g.category)).toEqual(['storage']);
  });
});
