import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { map } from 'rxjs';

import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../components/confirm-dialog/confirm-dialog.component';

export interface HasDirtyForm {
  isDirty(): boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<HasDirtyForm> = (component) => {
  if (!component?.isDirty || !component.isDirty()) {
    return true;
  }

  const dialog = inject(MatDialog);

  return dialog
    .open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Unsaved Changes',
        message: 'You have unsaved changes that will be lost. Are you sure you want to leave?',
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
        severity: 'warn',
      } satisfies ConfirmDialogData,
    })
    .afterClosed()
    .pipe(map((confirmed) => confirmed === true));
};
