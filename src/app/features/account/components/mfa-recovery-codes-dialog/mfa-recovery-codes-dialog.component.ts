import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { MfaService } from '../../services/mfa.service';

@Component({
  selector: 'app-mfa-recovery-codes-dialog',
  standalone: true,
  imports: [DialogComponent],
  templateUrl: './mfa-recovery-codes-dialog.component.html',
  styleUrl: './mfa-recovery-codes-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MfaRecoveryCodesDialogComponent {
  private readonly mfaService = inject(MfaService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialogRef = inject(MatDialogRef<MfaRecoveryCodesDialogComponent>);

  protected readonly codes = signal<string[]>([]);
  protected readonly warning = signal('');
  protected readonly loading = signal(true);

  constructor() {
    this.mfaService.generateRecoveryCodes().subscribe({
      next: (result) => {
        this.codes.set(result.codes);
        this.warning.set(result.warning);
        this.loading.set(false);
      },
      error: () => {
        this.snackbar.error('Failed to generate recovery codes');
        this.dialogRef.close();
      },
    });
  }

  protected copyAll(): void {
    const text = this.codes().join('\n');
    navigator.clipboard.writeText(text);
    this.snackbar.success('Recovery codes copied to clipboard');
  }

  protected download(): void {
    const text = [
      'QB Engineer — Recovery Codes',
      'Keep these codes in a safe place.',
      '',
      ...this.codes(),
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qb-engineer-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
