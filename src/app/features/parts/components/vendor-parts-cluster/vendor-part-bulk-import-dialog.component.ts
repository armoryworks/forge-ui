import {
  ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild,
} from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

import {
  VendorPartImportPreviewResponse,
  VendorPartImportResultResponse,
  VendorPartImportRowAction,
  VendorPartImportRowPreview,
} from '../../models/vendor-part-bulk-import.model';
import { VendorPartsService } from '../../services/vendor-parts.service';

export interface VendorPartBulkImportDialogData {
  /** Parent vendor id — required for both preview and apply POSTs. */
  vendorId: number;
  /** Used in the dialog header so the user knows which vendor they're targeting. */
  vendorName: string;
}

/**
 * CSV bulk-import dialog for VendorPart catalog rows. Two-state UI mirroring
 * the price-list-entry importer:
 *
 *  1. File picker (drag-and-drop + click-to-browse, .csv only, 5MB cap).
 *  2. Dry-run preview table with action chips + counts; user clicks Apply to
 *     commit. Apply re-uploads the same file — server is the authoritative
 *     parser.
 *
 * Conflict semantic is upsert by `(vendorId, partId)`: existing catalog rows
 * are updated, new rows inserted; nothing is deleted.
 */
@Component({
  selector: 'app-vendor-part-bulk-import-dialog',
  standalone: true,
  imports: [
    TranslatePipe, MatTooltipModule,
    DialogComponent, DataTableComponent, ColumnCellDirective,
  ],
  templateUrl: './vendor-part-bulk-import-dialog.component.html',
  styleUrl: './vendor-part-bulk-import-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorPartBulkImportDialogComponent {
  private readonly vendorPartsService = inject(VendorPartsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(
    MatDialogRef<VendorPartBulkImportDialogComponent, VendorPartImportResultResponse | null>,
  );
  protected readonly data = inject<VendorPartBulkImportDialogData>(MAT_DIALOG_DATA);

  protected readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly previewLoading = signal(false);
  protected readonly applying = signal(false);
  protected readonly preview = signal<VendorPartImportPreviewResponse | null>(null);
  protected readonly dragOver = signal(false);
  protected readonly fileError = signal<string | null>(null);

  protected readonly inPreviewState = computed(() => this.preview() !== null);

  protected readonly canApply = computed(() => {
    const p = this.preview();
    if (!p) return false;
    return p.errorCount === 0 && (p.addCount + p.updateCount) > 0;
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'lineNumber', header: '#', width: '50px', align: 'right' },
    { field: 'partNumber', header: 'Part #', width: '120px' },
    { field: 'partName', header: 'Description' },
    { field: 'vendorPartNumber', header: 'Vendor PN', width: '120px' },
    { field: 'leadTimeDays', header: 'Lead', width: '70px', align: 'right' },
    { field: 'minOrderQty', header: 'MOQ', width: '70px', align: 'right' },
    { field: 'action', header: 'Action', width: '100px' },
    { field: 'errorMessage', header: 'Error' },
  ];

  protected readonly rows = computed<VendorPartImportRowPreview[]>(
    () => this.preview()?.rows ?? [],
  );

  // ── State 1: file picker ───────────────────────────────────────────────

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.selectFile(file);
  }

  protected browse(): void {
    this.fileInput()?.nativeElement.click();
  }

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.selectFile(file);
    input.value = '';
  }

  private selectFile(file: File): void {
    this.fileError.set(null);

    // 5MB cap matches the controller's [RequestSizeLimit].
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      this.fileError.set(this.translate.instant('vendorPart.bulkImport.fileTooLarge'));
      return;
    }

    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv')) {
      this.fileError.set(this.translate.instant('vendorPart.bulkImport.fileTypeNotAllowed'));
      return;
    }

    this.selectedFile.set(file);
    this.runPreview(file);
  }

  private runPreview(file: File): void {
    this.previewLoading.set(true);
    this.vendorPartsService.previewImport(this.data.vendorId, file).subscribe({
      next: result => {
        this.preview.set(result);
        this.previewLoading.set(false);
      },
      error: () => {
        this.previewLoading.set(false);
        this.selectedFile.set(null);
        this.fileError.set(this.translate.instant('vendorPart.bulkImport.previewFailed'));
      },
    });
  }

  // ── State 2: preview + apply ───────────────────────────────────────────

  protected backToPicker(): void {
    this.preview.set(null);
    this.selectedFile.set(null);
    this.fileError.set(null);
  }

  protected apply(): void {
    const file = this.selectedFile();
    if (!file || !this.canApply() || this.applying()) return;
    this.applying.set(true);
    this.vendorPartsService.applyImport(this.data.vendorId, file).subscribe({
      next: result => {
        this.applying.set(false);
        this.snackbar.success(this.translate.instant('vendorPart.bulkImport.applySuccess', {
          added: result.addedCount,
          updated: result.updatedCount,
        }));
        this.dialogRef.close(result);
      },
      error: () => this.applying.set(false),
    });
  }

  protected close(): void {
    this.dialogRef.close(null);
  }

  // ── Template helpers ───────────────────────────────────────────────────

  protected actionChipClass(action: VendorPartImportRowAction): string {
    switch (action) {
      case 'Add': return 'chip chip--success';
      case 'Update': return 'chip chip--info';
      case 'Error': return 'chip chip--error';
      case 'Skip':
      default: return 'chip chip--muted';
    }
  }

  protected actionLabel(action: VendorPartImportRowAction): string {
    switch (action) {
      case 'Add': return this.translate.instant('vendorPart.bulkImport.actionAdd');
      case 'Update': return this.translate.instant('vendorPart.bulkImport.actionUpdate');
      case 'Error': return this.translate.instant('vendorPart.bulkImport.actionError');
      case 'Skip':
      default: return this.translate.instant('vendorPart.bulkImport.actionSkip');
    }
  }

  /** Download a template CSV (header row + one example row). */
  protected downloadTemplate(): void {
    const header = 'partNumber,vendorPartNumber,manufacturerName,vendorMpn,leadTimeDays,minOrderQty,packSize,countryOfOrigin,htsCode,notes';
    const example = 'PART-001,VP-001,Acme,MPN-1,7,10,1,US,1234567890,Primary source';
    const csv = `${header}\n${example}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vendor-parts-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
