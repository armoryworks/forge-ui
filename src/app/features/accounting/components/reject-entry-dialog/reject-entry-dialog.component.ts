import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TranslatePipe } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';

export interface RejectEntryDialogData {
  entryNumber: number;
}

/**
 * Maker-checker rejection (§5.7): asks for an optional reason and returns it (`''` when left blank).
 * Closing without confirming returns `undefined`. The server returns the entry to Draft.
 */
@Component({
  selector: 'app-reject-entry-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent],
  templateUrl: './reject-entry-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RejectEntryDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<RejectEntryDialogComponent, string | undefined>);
  protected readonly data = inject<RejectEntryDialogData>(MAT_DIALOG_DATA);

  protected readonly reason = new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] });

  protected close(): void {
    this.dialogRef.close();
  }

  protected confirm(): void {
    if (this.reason.invalid) return;
    this.dialogRef.close(this.reason.value.trim());
  }
}
