import {
  ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild,
} from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ColumnCellDirective } from '../../../../../shared/directives/column-cell.directive';
import { CurrencyDisplayComponent } from '../../../../../shared/components/currency-display/currency-display.component';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { DialogComponent } from '../../../../../shared/components/dialog/dialog.component';
import { ColumnDef } from '../../../../../shared/models/column-def.model';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';

import {
  BulkImportPreviewResponse,
  BulkImportResultResponse,
  BulkImportRowAction,
  BulkImportRowPreview,
} from '../../../models/price-list-bulk-import.model';
import { PriceListsService } from '../../../services/price-lists.service';

export interface PriceListEntryBulkImportDialogData {
  /** Parent list id — required for both preview and apply POSTs. */
  priceListId: number;
  /** Used in the dialog header so the user knows which list they're targeting. */
  priceListName: string;
}

/**
 * CSV bulk-import dialog for `PriceListEntry` rows. Two-state UI per the
 * universal ERP convention surveyed in
 * `phase-4-output/pricelist-entry-edit-ux.md`:
 *
 *  1. File picker (drag-and-drop + click-to-browse, .csv only, 5MB cap).
 *  2. Dry-run preview table with action chips + counts; user clicks Apply
 *     to commit. Apply re-uploads the same file — server is the
 *     authoritative parser.
 *
 * Conflict semantic is upsert by `(partId, minQuantity)`: existing rows are
 * updated, new rows are inserted; nothing is deleted (replace-mode is its
 * own follow-up dispatch).
 */
@Component({
  selector: 'app-price-list-entry-bulk-import-dialog',
  standalone: true,
  imports: [
    TranslatePipe, MatTooltipModule,
    DialogComponent, DataTableComponent, ColumnCellDirective,
    CurrencyDisplayComponent,
  ],
  templateUrl: './price-list-entry-bulk-import-dialog.component.html',
  styleUrl: './price-list-entry-bulk-import-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceListEntryBulkImportDialogComponent {
  private readonly priceListsService = inject(PriceListsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(
    MatDialogRef<PriceListEntryBulkImportDialogComponent, BulkImportResultResponse | null>,
  );
  protected readonly data = inject<PriceListEntryBulkImportDialogData>(MAT_DIALOG_DATA);

  protected readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly previewLoading = signal(false);
  protected readonly applying = signal(false);
  protected readonly preview = signal<BulkImportPreviewResponse | null>(null);
  protected readonly dragOver = signal(false);
  protected readonly fileError = signal<string | null>(null);

  /** True once we have a preview and the user is on State 2. */
  protected readonly inPreviewState = computed(() => this.preview() !== null);

  protected readonly canApply = computed(() => {
    const p = this.preview();
    if (!p) return false;
    // Preview rows include adds, updates, and errors. Apply is allowed when
    // there's at least one Add/Update AND no errors. The user can reupload
    // a corrected file to fix errors.
    return p.errorCount === 0 && (p.addCount + p.updateCount) > 0;
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'lineNumber', header: '#', width: '50px', align: 'right' },
    { field: 'partNumber', header: 'Part #', width: '120px' },
    { field: 'partName', header: 'Description' },
    { field: 'unitPrice', header: 'Unit Price', width: '110px', align: 'right' },
    { field: 'minQuantity', header: 'Min Qty', width: '80px', align: 'right' },
    { field: 'currency', header: 'Currency', width: '80px' },
    { field: 'notes', header: 'Notes' },
    { field: 'action', header: 'Action', width: '100px' },
    { field: 'errorMessage', header: 'Error' },
  ];

  protected readonly rows = computed<BulkImportRowPreview[]>(
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
      this.fileError.set(this.translate.instant('priceListEntry.bulkImport.fileTooLarge'));
      return;
    }

    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv')) {
      this.fileError.set(this.translate.instant('priceListEntry.bulkImport.fileTypeNotAllowed'));
      return;
    }

    this.selectedFile.set(file);
    this.runPreview(file);
  }

  private runPreview(file: File): void {
    this.previewLoading.set(true);
    this.priceListsService.previewImport(this.data.priceListId, file).subscribe({
      next: result => {
        this.preview.set(result);
        this.previewLoading.set(false);
      },
      error: () => {
        this.previewLoading.set(false);
        this.selectedFile.set(null);
        this.fileError.set(this.translate.instant('priceListEntry.bulkImport.previewFailed'));
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
    this.priceListsService.applyImport(this.data.priceListId, file).subscribe({
      next: result => {
        this.applying.set(false);
        this.snackbar.success(this.translate.instant('priceListEntry.bulkImport.applySuccess', {
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

  protected actionChipClass(action: BulkImportRowAction): string {
    switch (action) {
      case 'Add': return 'chip chip--success';
      case 'Update': return 'chip chip--info';
      case 'Error': return 'chip chip--error';
      case 'Skip':
      default: return 'chip chip--muted';
    }
  }

  protected actionLabel(action: BulkImportRowAction): string {
    switch (action) {
      case 'Add': return this.translate.instant('priceListEntry.bulkImport.actionAdd');
      case 'Update': return this.translate.instant('priceListEntry.bulkImport.actionUpdate');
      case 'Error': return this.translate.instant('priceListEntry.bulkImport.actionError');
      case 'Skip':
      default: return this.translate.instant('priceListEntry.bulkImport.actionSkip');
    }
  }

  /** Generate a download URL for the template CSV (header row + 1 example row). */
  protected downloadTemplate(): void {
    const csv = 'partNumber,unitPrice,minQuantity,currency,notes\nPART-001,5.00,1,USD,Intro tier\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'price-list-entries-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
