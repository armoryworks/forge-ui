import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { MfaService } from '../../services/mfa.service';
import { MfaRecoveryCodesDialogComponent } from './mfa-recovery-codes-dialog.component';

describe('MfaRecoveryCodesDialogComponent', () => {
  const mfa = { generateRecoveryCodes: vi.fn(() => of({ codes: ['A1', 'B2'], warning: 'w' })) };

  function open(remainingCodes: number): { step(): string; generate(): void } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: MAT_DIALOG_DATA, useValue: { remainingCodes } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: MfaService, useValue: mfa },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      ],
    });
    return TestBed.runInInjectionContext(() => new MfaRecoveryCodesDialogComponent()) as unknown as { step(): string; generate(): void };
  }

  beforeEach(() => vi.clearAllMocks());

  it('does not replace existing codes until the user confirms', () => {
    const dialog = open(7);

    expect(dialog.step()).toBe('confirm');
    expect(mfa.generateRecoveryCodes).not.toHaveBeenCalled();

    dialog.generate();

    expect(mfa.generateRecoveryCodes).toHaveBeenCalledTimes(1);
    expect(dialog.step()).toBe('codes');
  });

  it('generates straight away when there are no codes to lose', () => {
    const dialog = open(0);

    expect(mfa.generateRecoveryCodes).toHaveBeenCalledTimes(1);
    expect(dialog.step()).toBe('codes');
  });
});
