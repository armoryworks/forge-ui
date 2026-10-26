import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { PaymentRunDetailDialogComponent } from './payment-run-detail-dialog.component';
import { PaymentRunService } from '../../services/payment-run.service';
import { PaymentRunDetail } from '../../models/payment-run-detail.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';

interface DialogInternals {
  run(): PaymentRunDetail | null;
  resume(): void;
  close(): void;
}

describe('PaymentRunDetailDialogComponent', () => {
  it('loads the run, resumes it and reports the change on close', () => {
    const run = { id: 5, runNumber: 'PR-000005', status: 'Interrupted', items: [] } as unknown as PaymentRunDetail;
    const resume = vi.fn(() => of({ ...run, status: 'Completed' }));
    const close = vi.fn();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: MAT_DIALOG_DATA, useValue: { runId: 5 } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: PaymentRunService, useValue: { getById: vi.fn(() => of(run)), resume } },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: AuthService, useValue: { hasAnyRole: () => true } },
      ],
    });
    const dialog = TestBed.runInInjectionContext(() => new PaymentRunDetailDialogComponent()) as unknown as DialogInternals;

    expect(dialog.run()?.status).toBe('Interrupted');
    dialog.resume();
    expect(resume).toHaveBeenCalledWith(5);
    expect(dialog.run()?.status).toBe('Completed');
    dialog.close();
    expect(close).toHaveBeenCalledWith(true);
  });
});
