import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { map } from 'rxjs';

import { TranslateService } from '@ngx-translate/core';

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
        title: translate.instant('common.unsavedChanges.title'),
        message: translate.instant('common.unsavedChanges.message'),
        confirmLabel: translate.instant('common.unsavedChanges.leave'),
        cancelLabel: translate.instant('common.unsavedChanges.stay'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    })
    .afterClosed()
    .pipe(map((confirmed) => confirmed === true));
};
