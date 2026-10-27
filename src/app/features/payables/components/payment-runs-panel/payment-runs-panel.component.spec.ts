import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { PaymentRunsPanelComponent } from './payment-runs-panel.component';
import { PaymentRunService } from '../../services/payment-run.service';
import { PaymentRunListItem } from '../../models/payment-run-list-item.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';

interface PanelInternals {
  runs(): PaymentRunListItem[];
  canManage: boolean;
  resume(run: PaymentRunListItem): void;
  cancel(run: PaymentRunListItem): void;
}

const interrupted = { id: 5, runNumber: 'PR-000005', status: 'Interrupted', pendingCount: 1, failedCount: 1 } as PaymentRunListItem;

describe('PaymentRunsPanelComponent', () => {
  let service: Record<string, ReturnType<typeof vi.fn>>;

  const build = (roles: string[]): PanelInternals => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: PaymentRunService, useValue: service },
        { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of(true) })) } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
      ],
    });
    return TestBed.runInInjectionContext(() => new PaymentRunsPanelComponent()) as unknown as PanelInternals;
  };

  beforeEach(() => {
    service = {
      getRuns: vi.fn(() => of([interrupted])),
      resume: vi.fn(() => of({ ...interrupted, status: 'Completed' })),
      cancel: vi.fn(() => of({ ...interrupted, status: 'Cancelled' })),
    };
  });

  it('lists runs and resumes an interrupted one', () => {
    const panel = build(['OfficeManager']);
    expect(panel.runs()).toEqual([interrupted]);
    expect(panel.canManage).toBe(true);

    panel.resume(interrupted);

    expect(service['resume']).toHaveBeenCalledWith(5);
    expect(service['getRuns']).toHaveBeenCalledTimes(2);
  });

  it('cancels after confirming', () => {
    const panel = build(['Manager']);
    panel.cancel(interrupted);
    expect(service['cancel']).toHaveBeenCalledWith(5);
  });

  it('lets the Controller read runs without resuming them', () => {
    expect(build(['Controller']).canManage).toBe(false);
  });
});
