import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { AccountingService } from '../../../../shared/services/accounting.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { QuickBooksService } from '../../services/quickbooks.service';
import { AdminService } from '../../services/admin.service';
import { IntegrationStatus } from '../../models/integration-status.model';
import { IntegrationsPanelComponent } from './integrations-panel.component';

function integration(provider: string, category: IntegrationStatus['category']): IntegrationStatus {
  return {
    provider, name: provider, description: '', icon: 'extension', isConfigured: false, fields: [],
    category, sandboxSteps: null, sandboxUrl: null, logoUrl: null,
  };
}

describe('IntegrationsPanelComponent', () => {
  let component: IntegrationsPanelComponent;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AccountingService,
          useValue: {
            providers: signal([]), providerId: signal(null), isConfigured: signal(false),
            loading: signal(false), syncStatus: signal(null),
            loadProviders: vi.fn(), loadSyncStatus: vi.fn(),
          },
        },
        { provide: QuickBooksService, useValue: { status: signal(null), loading: signal(false), loadStatus: vi.fn() } },
        { provide: CapabilityService, useValue: { isEnabled: () => false } },
        {
          provide: AdminService,
          useValue: {
            getIntegrations: () => of({
              showSandboxGuides: false,
              integrations: [
                integration('gmail-oauth', 'communications'),
                integration('twilio', 'communications'),
                integration('smtp', 'service'),
                integration('quickbooks', 'accounting'),
                integration('ups', 'shipping'),
              ],
            }),
          },
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: SnackbarService, useValue: {} },
      ],
    });
    component = TestBed.runInInjectionContext(() => new IntegrationsPanelComponent());
    component.ngOnInit();
  });

  it('lists communications integrations so an admin can reconfigure them after setup', () => {
    expect(component.serviceIntegrations().map(i => i.provider)).toEqual(['gmail-oauth', 'twilio', 'smtp']);
  });

  it('keeps shipping and accounting out of the services list', () => {
    expect(component.shippingIntegrations().map(i => i.provider)).toEqual(['ups']);
    expect(component.serviceIntegrations().some(i => i.category === 'accounting')).toBe(false);
  });
});
