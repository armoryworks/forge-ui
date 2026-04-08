import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

import { ConfirmDialogComponent, ConfirmDialogData } from '../confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [MatTooltipModule, TranslatePipe],
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogComponent {
  private readonly dialog = inject(MatDialog);

  readonly title = input.required<string>();
  readonly width = input<string>('420px');
  readonly splitLayout = input<boolean>(false);
  readonly dirty = input<boolean>(false);
  readonly closed = output<void>();

  tryClose(): void {
    if (!this.dirty()) {
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
}
