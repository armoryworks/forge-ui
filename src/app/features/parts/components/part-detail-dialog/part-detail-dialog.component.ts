import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { filter } from 'rxjs';

import { PartDetailPanelComponent } from '../part-detail-panel/part-detail-panel.component';
import { DialogEscapeHandler } from '../../../../shared/models/dialog-escape.model';
import { PendingChangesService } from '../../../../shared/services/pending-changes.service';

export interface PartDetailDialogData {
  partId: number;
}

const NESTED_ESCAPE_OWNERS = 'input, textarea, select, [contenteditable="true"], app-dialog';

@Component({
  selector: 'app-part-detail-dialog',
  standalone: true,
  imports: [PartDetailPanelComponent],
  templateUrl: './part-detail-dialog.component.html',
  styleUrl: './part-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartDetailDialogComponent implements DialogEscapeHandler {
  private readonly dialogRef = inject(MatDialogRef<PartDetailDialogComponent>);
  private readonly pendingChanges = inject(PendingChangesService);
  protected readonly data = inject<PartDetailDialogData>(MAT_DIALOG_DATA);
  readonly partCreated = output<void>();

  constructor() {
    this.dialogRef.keydownEvents()
      .pipe(
        filter(event => event.key === 'Escape' && !event.defaultPrevented && !this.ownedByNestedControl(event)),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.close());
  }

  onDialogEscape(): void {
    this.close();
  }

  protected close(): void {
    this.pendingChanges.confirmDiscard().subscribe(discard => {
      if (discard) this.dialogRef.close();
    });
  }

  protected onEditRequested(part: unknown): void {
    this.pendingChanges.confirmDiscard().subscribe(discard => {
      if (discard) this.dialogRef.close({ action: 'edit', part });
    });
  }

  private ownedByNestedControl(event: KeyboardEvent): boolean {
    const target = event.target;
    return target instanceof Element && target.closest(NESTED_ESCAPE_OWNERS) !== null;
  }
}
