import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
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
  const translate = inject(TranslateService);

  return dialog
    .open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: translate.instant('dialog.unsaved.title'),
        message: translate.instant('dialog.unsaved.leaveMessage'),
        confirmLabel: translate.instant('dialog.unsaved.leave'),
        cancelLabel: translate.instant('dialog.unsaved.stay'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    })
    .afterClosed()
    .pipe(map((confirmed) => confirmed === true));
};
