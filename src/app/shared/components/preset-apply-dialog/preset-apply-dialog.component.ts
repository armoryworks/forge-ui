import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TextareaComponent } from '../textarea/textarea.component';
import { DialogEscapeHandler } from '../../models/dialog-escape.model';
import { DialogEscapeService } from '../../services/dialog-escape.service';
import {
  PresetApplyViolation,
  PresetCapabilityDelta,
} from '../../models/preset.model';
import { TranslatePipe } from '@ngx-translate/core';

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
  /** When true, delta rows show only the capability name, not its internal code (self-serve discovery). */
  hideCodes?: boolean;
}

export interface PresetApplyDialogResult {
  confirmed: boolean;
  reason?: string;
}

@Component({
  selector: 'app-preset-apply-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TextareaComponent, TranslatePipe],
  templateUrl: './preset-apply-dialog.component.html',
  styleUrl: './preset-apply-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresetApplyDialogComponent implements DialogEscapeHandler {
  readonly data: PresetApplyDialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<PresetApplyDialogComponent, PresetApplyDialogResult>);
  private readonly dialogEscape = inject(DialogEscapeService);

  protected readonly reasonControl = new FormControl<string>('');

  protected readonly enableDeltas = computed(() =>
    this.data.deltas.filter((d) => d.willBeEnabled),
  );
  protected readonly disableDeltas = computed(() =>
    this.data.deltas.filter((d) => !d.willBeEnabled),
  );
  protected readonly hasViolations = computed(() => this.data.violations.length > 0);
  protected readonly canConfirm = computed(() => !this.hasViolations());

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

  onDialogEscape(): void {
    this.dialogEscape.closeUnlessDirty(!!this.reasonControl.value?.trim(), () => this.cancel());
  }

  protected cancel(): void {
    this.dialogRef.close({ confirmed: false });
  }
}
