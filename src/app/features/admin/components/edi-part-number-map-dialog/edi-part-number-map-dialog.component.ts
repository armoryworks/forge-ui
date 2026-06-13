import { ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';

import { EdiService } from '../../services/edi.service';
import { EdiTradingPartner } from '../../models/edi-trading-partner.model';
import { EdiPartNumberMapRow } from '../../models/edi-part-number-map-row.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

/// ⚡ EDI BOUNDARY — per-partner part-number translation editor (typed rows + CSV bulk import).
/// Closes the EDI_CORE_PLAN §Known functional gap from the UI: partner part number → our part
/// number. Rows resolving to a real part show its description; unresolved targets are flagged so
/// the data quality is visible. No JSON — typed grid only.
@Component({
  selector: 'app-edi-part-number-map-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe, MatTooltipModule, DialogComponent, LoadingBlockDirective],
  templateUrl: './edi-part-number-map-dialog.component.html',
  styleUrl: './edi-part-number-map-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EdiPartNumberMapDialogComponent implements OnInit {
  private readonly ediService = inject(EdiService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly partner = input.required<EdiTradingPartner>();
  readonly closed = output<void>();

  @ViewChild('csvInput') private csvInput!: ElementRef<HTMLInputElement>;

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly rows = signal<EdiPartNumberMapRow[]>([]);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.ediService.getPartNumberMap(this.partner().id).subscribe({
      next: (rows) => { this.rows.set(rows); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected addRow(): void {
    this.rows.update(r => [...r, { partnerPartNumber: '', ourPartNumber: '', ourPartId: null, ourPartDescription: null }]);
  }

  protected removeRow(index: number): void {
    this.rows.update(r => r.filter((_, i) => i !== index));
  }

  protected onPartnerNumberChange(index: number, value: string): void {
    this.rows.update(r => r.map((row, i) => i === index ? { ...row, partnerPartNumber: value } : row));
  }

  protected onOurNumberChange(index: number, value: string): void {
    // Clear the stale resolution preview until the next save re-resolves against the catalog.
    this.rows.update(r => r.map((row, i) =>
      i === index ? { ...row, ourPartNumber: value, ourPartId: null, ourPartDescription: null } : row));
  }

  protected save(): void {
    this.saving.set(true);
    this.ediService.savePartNumberMap(this.partner().id, this.rows()).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('adminPanels.edi.partMap.saved'));
      },
      error: () => this.saving.set(false),
    });
  }

  protected pickCsv(): void {
    this.csvInput.nativeElement.click();
  }

  protected onCsvSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.loading.set(true);
    this.ediService.importPartNumberMap(this.partner().id, file).subscribe({
      next: (result) => {
        this.snackbar.success(this.translate.instant('adminPanels.edi.partMap.imported', {
          imported: result.imported, updated: result.updated, unresolved: result.unresolved,
        }));
        this.load();
      },
      error: () => this.loading.set(false),
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected trackByIndex(index: number): number {
    return index;
  }
}
