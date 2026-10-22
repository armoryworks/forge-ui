import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { Subject, throwError } from 'rxjs';

import { LeadsService } from '../../services/leads.service';
import { OutreachCampaignsService } from '../../services/outreach-campaigns.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LeadDetailPanelComponent } from './lead-detail-panel.component';

interface PanelInternals {
  openConvertedCustomer(customerId: number): void;
  lead: { set(lead: unknown): void };
  lostReasonControl: { setValue(value: string): void };
  confirmLost(): void;
}

function lostSetup(updateLead: ReturnType<typeof vi.fn>): PanelInternals {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: LeadsService, useValue: { updateLead } },
      { provide: OutreachCampaignsService, useValue: {} },
      { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
      { provide: MatDialog, useValue: {} },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  const panel = TestBed.runInInjectionContext(() => new LeadDetailPanelComponent()) as unknown as PanelInternals;
  panel.lead.set({ id: 4, status: 'Contacted' });
  panel.lostReasonControl.setValue('Went elsewhere');
  return panel;
}

describe('LeadDetailPanelComponent', () => {
  it('opens the converted customer and closes the lead dialog once there', async () => {
    const navigate = vi.fn(() => Promise.resolve(true));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate } },
        { provide: LeadsService, useValue: {} },
        { provide: OutreachCampaignsService, useValue: {} },
        { provide: SnackbarService, useValue: {} },
        { provide: MatDialog, useValue: {} },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new LeadDetailPanelComponent());
    const closed = vi.fn();
    component.closed.subscribe(closed);

    (component as unknown as PanelInternals).openConvertedCustomer(7);
    await Promise.resolve();

    expect(navigate).toHaveBeenCalledWith(['/customers', 7, 'overview']);
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('marks the lead Lost once when Confirm is pressed twice before the server answers', () => {
    const updateLead = vi.fn(() => new Subject());
    const panel = lostSetup(updateLead);

    panel.confirmLost();
    panel.confirmLost();

    expect(updateLead).toHaveBeenCalledTimes(1);
  });

  it('lets Confirm Lost be pressed again after the server rejects the first press', () => {
    const updateLead = vi.fn(() => throwError(() => new Error('500')));
    const panel = lostSetup(updateLead);

    panel.confirmLost();
    panel.confirmLost();

    expect(updateLead).toHaveBeenCalledTimes(2);
  });
});
