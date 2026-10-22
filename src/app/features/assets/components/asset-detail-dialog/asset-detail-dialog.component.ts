import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { AssetDetailPanelComponent } from '../asset-detail-panel/asset-detail-panel.component';
import { AssetItem } from '../../models/asset-item.model';
import { DialogEscapeHandler } from '../../../../shared/models/dialog-escape.model';

export interface AssetDetailDialogData {
  assetId: number;
}

export interface AssetDetailDialogResult {
  action: 'edit';
  asset: AssetItem;
}

@Component({
  selector: 'app-asset-detail-dialog',
  standalone: true,
  imports: [AssetDetailPanelComponent],
  template: `
    <app-asset-detail-panel
      [assetId]="data.assetId"
      (closed)="close()"
      (editRequested)="onEditRequested($event)" />
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; } app-asset-detail-panel { height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetDetailDialogComponent implements DialogEscapeHandler {
  private readonly dialogRef = inject(MatDialogRef<AssetDetailDialogComponent, AssetDetailDialogResult | undefined>);

  protected readonly data = inject<AssetDetailDialogData>(MAT_DIALOG_DATA);

  onDialogEscape(): void {
    this.close();
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected onEditRequested(asset: AssetItem): void {
    this.dialogRef.close({ action: 'edit', asset });
  }
}
