import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { MfaService } from '../../services/mfa.service';

export interface MfaRecoveryCodesDialogData {
  remainingCodes: number;
}

@Component({
  selector: 'app-mfa-recovery-codes-dialog',
  standalone: true,
  imports: [DialogComponent, TranslatePipe],
  templateUrl: './mfa-recovery-codes-dialog.component.html',
  styleUrl: './mfa-recovery-codes-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MfaRecoveryCodesDialogComponent {
  private readonly mfaService = inject(MfaService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialogRef = inject(MatDialogRef<MfaRecoveryCodesDialogComponent>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly data = inject<MfaRecoveryCodesDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  protected readonly remainingCodes = this.data?.remainingCodes ?? 0;
  protected readonly codes = signal<string[]>([]);
  protected readonly warning = signal('');
  protected readonly step = signal<'confirm' | 'loading' | 'codes'>(this.remainingCodes > 0 ? 'confirm' : 'loading');

  constructor() {
    if (this.step() === 'loading') this.generate();
  }

  protected generate(): void {
    this.step.set('loading');
    this.mfaService.generateRecoveryCodes().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.codes.set(result.codes);
        this.warning.set(result.warning);
        this.step.set('codes');
      },
      error: (err: unknown) => {
        this.snackbar.errorFrom(err, 'errorFallbacksA.recoveryCodesFailed');
        this.dialogRef.close();
      },
    });
  }

  protected copyAll(): void {
    const text = this.codes().join('\n');
    navigator.clipboard.writeText(text);
    this.snackbar.success(this.translate.instant('account.mfa.recoveryCodesCopied'));
  }

  protected download(): void {
    const text = [
      'Forge — Recovery Codes',
      'Keep these codes in a safe place.',
      '',
      ...this.codes(),
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'forge-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
