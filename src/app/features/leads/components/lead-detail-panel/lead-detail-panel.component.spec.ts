import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';

import { LeadsService } from '../../services/leads.service';
import { OutreachCampaignsService } from '../../services/outreach-campaigns.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LeadDetailPanelComponent } from './lead-detail-panel.component';

interface PanelInternals {
  openConvertedCustomer(customerId: number): void;
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
});
