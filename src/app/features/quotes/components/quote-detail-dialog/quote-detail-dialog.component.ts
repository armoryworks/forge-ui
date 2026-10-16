import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { QuoteDetailPanelComponent } from '../quote-detail-panel/quote-detail-panel.component';

export interface QuoteDetailDialogData {
  quoteId: number;
}

@Component({
  selector: 'app-quote-detail-dialog',
  standalone: true,
  imports: [QuoteDetailPanelComponent],
  template: `
    <app-quote-detail-panel
      [quoteId]="data.quoteId"
      (closed)="close()"
      (changed)="onChanged()" />
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; } app-quote-detail-panel { height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteDetailDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<QuoteDetailDialogComponent, QuoteDetailDialogResult | undefined>);

  protected readonly data = inject<QuoteDetailDialogData>(MAT_DIALOG_DATA);

  private changed = false;

  protected close(): void {
    this.dialogRef.close(this.changed ? { changed: true } : undefined);
  }

  protected onChanged(): void {
    this.changed = true;
  }
}

export interface QuoteDetailDialogResult {
  changed: boolean;
}
