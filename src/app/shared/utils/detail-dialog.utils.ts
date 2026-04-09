import { ComponentType } from '@angular/cdk/overlay';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';

export function openDetailDialog<T, D, R = undefined>(
  dialog: MatDialog,
  component: ComponentType<T>,
  data: D,
): MatDialogRef<T, R> {
  return dialog.open(component, {
    width: '1400px',
    maxWidth: '95vw',
    panelClass: 'detail-dialog-panel',
    data,
  });
}
