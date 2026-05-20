import {
  ChangeDetectionStrategy, Component, DestroyRef, HostListener, inject, input, OnInit, output, signal,
} from '@angular/core';
import { FormGroup } from '@angular/forms';

import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

import { ConfirmDialogComponent, ConfirmDialogData } from '../confirm-dialog/confirm-dialog.component';
import { DirtyFormIndicatorComponent } from '../dirty-form-indicator/dirty-form-indicator.component';
import { DraftRecoveryBannerComponent } from '../draft-recovery-banner/draft-recovery-banner.component';
import { DraftService } from '../../services/draft.service';
import { DraftConfig } from '../../models/draft-config.model';

@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [MatTooltipModule, TranslatePipe, DirtyFormIndicatorComponent, DraftRecoveryBannerComponent],
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly draftService = inject(DraftService);
  private readonly destroyRef = inject(DestroyRef);
  // Non-null only when this <app-dialog> is itself rendered inside a MatDialog
  // overlay — in that case the CDK already handles Escape, so we must not
  // double-handle it. Null for the inline usage (rendered directly in a page
  // template), which is the case that needs the document-level Escape handler.
  private readonly hostMatDialogRef = inject(MatDialogRef, { optional: true });

  readonly title = input.required<string>();
  readonly width = input<string>('420px');
  readonly splitLayout = input<boolean>(false);
  readonly dirty = input<boolean>(false);
  readonly closed = output<void>();

  /** Optional draft config — when provided with draftFormGroup, enables auto-save/recovery. */
  readonly draftConfig = input<DraftConfig | null>(null);
  /** The FormGroup to auto-save. Required when draftConfig is set. */
  readonly draftFormGroup = input<FormGroup | null>(null);

  protected readonly restoredDraftTimestamp = signal<number | null>(null);
  protected readonly isDraftEnabled = signal(false);

  ngOnInit(): void {
    const config = this.draftConfig();
    const formGroup = this.draftFormGroup();
    if (!config || !formGroup) return;

    this.isDraftEnabled.set(true);

    // Build a DraftableForm adapter for the DraftService
    const adapter = this.buildAdapter(config, formGroup);

    // Load existing draft
    this.draftService.loadDraft(config.entityType, config.entityId).then(draft => {
      if (draft) {
        if (config.restoreFn) {
          config.restoreFn(draft.formData);
        } else {
          formGroup.patchValue(draft.formData);
        }
        formGroup.markAsDirty();
        this.restoredDraftTimestamp.set(draft.lastModified);
      }
    });

    // Register for auto-save
    this.draftService.register(adapter);

    // Unregister on destroy (dialog close / component teardown)
    this.destroyRef.onDestroy(() => {
      this.draftService.unregister(config.entityType, config.entityId);
    });
  }

  /** Call from parent component after successful save to clear the draft. */
  clearDraft(): void {
    const config = this.draftConfig();
    if (config) {
      this.draftService.clearDraftAndBroadcastSave(config.entityType, config.entityId);
    }
  }

  protected discardDraft(): void {
    const config = this.draftConfig();
    if (config) {
      this.draftService.clearDraft(config.entityType, config.entityId);
    }
    this.restoredDraftTimestamp.set(null);
  }

  protected isDirty(): boolean {
    const config = this.draftConfig();
    if (config && this.draftFormGroup()) {
      return this.draftFormGroup()!.dirty;
    }
    return this.dirty();
  }

  /**
   * Escape closes the dialog through the same path as the X button (incl. the
   * unsaved-changes confirm). Only active for the inline usage — MatDialog-
   * hosted dialogs get Escape from the CDK overlay, and a nested confirm
   * owns Escape while it's open.
   */
  @HostListener('document:keydown.escape')
  protected onEscapeKey(): void {
    if (this.hostMatDialogRef) return;
    if (this.dialog.openDialogs.length > 0) return;
    this.tryClose();
  }

  tryClose(): void {
    if (!this.isDirty()) {
      this.closed.emit();
      return;
    }

    this.dialog
      .open(ConfirmDialogComponent, {
        width: '400px',
        data: {
          title: 'Unsaved Changes',
          message: 'You have unsaved changes that will be lost. Are you sure you want to close?',
          confirmLabel: 'Close',
          cancelLabel: 'Stay',
          severity: 'warn',
        } satisfies ConfirmDialogData,
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.closed.emit();
        }
      });
  }

  private buildAdapter(config: DraftConfig, formGroup: FormGroup) {
    return {
      entityType: config.entityType,
      entityId: config.entityId,
      displayLabel: config.displayLabel ?? this.title(),
      route: config.route,
      form: formGroup,
      isDirty: () => formGroup.dirty,
      getFormSnapshot: () => config.snapshotFn ? config.snapshotFn() : formGroup.getRawValue(),
      restoreDraft: (data: Record<string, unknown>) => {
        if (config.restoreFn) {
          config.restoreFn(data);
        } else {
          formGroup.patchValue(data);
        }
        formGroup.markAsDirty();
      },
    };
  }
}
