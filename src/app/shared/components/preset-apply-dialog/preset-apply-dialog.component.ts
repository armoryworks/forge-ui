import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TextareaComponent } from '../textarea/textarea.component';
import {
  PresetApplyViolation,
  PresetCapabilityDelta,
} from '../../models/preset.model';

/**
 * Phase 4 Phase-G — Reusable apply-confirmation modal data.
 *
 * Used by every preset-apply entry point: preset-detail Apply button,
 * Custom-builder Apply button, discovery override-after-review apply,
 * and re-apply scenarios. The dialog is presentation-only — it shows the
 * deltas and violations, captures an optional reason, and signals
 * confirm / cancel. The caller performs the actual mutation.
 */
export interface PresetApplyDialogData {
  presetId: string;
  presetName: string;
  isCustom: boolean;
  deltas: PresetCapabilityDelta[];
  violations: PresetApplyViolation[];
  /** When true, the dialog displays the no-op state — "everything already matches" */
  noOp?: boolean;
}

export interface PresetApplyDialogResult {
  confirmed: boolean;
  reason?: string;
}

@Component({
  selector: 'app-preset-apply-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TextareaComponent],
  templateUrl: './preset-apply-dialog.component.html',
  styleUrl: './preset-apply-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresetApplyDialogComponent {
  readonly data: PresetApplyDialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<PresetApplyDialogComponent, PresetApplyDialogResult>);

  protected readonly reasonControl = new FormControl<string>('');

  protected readonly enableDeltas = computed(() =>
    this.data.deltas.filter((d) => d.willBeEnabled),
  );
  protected readonly disableDeltas = computed(() =>
    this.data.deltas.filter((d) => !d.willBeEnabled),
  );
  protected readonly hasViolations = computed(() => this.data.violations.length > 0);
  protected readonly canConfirm = computed(() => !this.hasViolations() && !this.data.noOp);

  protected readonly enableCount = signal(0);
  protected readonly disableCount = signal(0);

  constructor() {
    this.enableCount.set(this.data.deltas.filter((d) => d.willBeEnabled).length);
    this.disableCount.set(this.data.deltas.filter((d) => !d.willBeEnabled).length);
  }

  protected confirm(): void {
    if (!this.canConfirm()) return;
    this.dialogRef.close({
      confirmed: true,
      reason: this.reasonControl.value?.trim() || undefined,
    });
  }

  protected cancel(): void {
    this.dialogRef.close({ confirmed: false });
  }
}
