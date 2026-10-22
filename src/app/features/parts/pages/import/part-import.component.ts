import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { parse, ParseResult } from 'papaparse';

import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { PartsService } from '../../services/parts.service';
import {
  BulkPartIntakeResponse,
  BulkPartIntakeRow,
  BulkPartIntakeRowResult,
  BulkPartIntakeRowStatus,
} from '../../models/bulk-part-intake.model';

interface CsvParseRow {
  [key: string]: string | undefined;
}

/**
 * Part bulk import — upload a CSV (or paste comma-/tab-separated rows), the page parses + sends
 * to the preview endpoint (classifies each row new / duplicate-in-batch / duplicate-existing /
 * invalid without persisting), renders a per-row status table, then commits the new rows. Part
 * numbers are server-issued: preview shows the number each new row would get, commit the one it
 * got, and the page stays put so the result can be read. Rows with data but no name are kept so
 * the server reports them as invalid; fully blank rows are dropped. Column aliases:
 *   name/part/partname/description(→name only if no name col) → name;
 *   description/desc/notes → description; procurement/source/make-buy → procurementSource;
 *   class/inventoryclass/category → inventoryClass; partnumber/mpn/sku/externalid → externalId.
 * Mirrors the customer bulk-import page.
 */
@Component({
  selector: 'app-part-import-page',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, PageLayoutComponent, TextareaComponent, LoadingBlockDirective],
  templateUrl: './part-import.component.html',
  styleUrl: './part-import.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartImportPageComponent {
  private readonly service = inject(PartsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly router = inject(Router);
  protected readonly translate = inject(TranslateService);

  protected readonly pasteControl = new FormControl<string>('', { nonNullable: true });

  protected readonly parsedRows = signal<BulkPartIntakeRow[]>([]);
  protected readonly parseErrors = signal<string[]>([]);
  protected readonly preview = signal<BulkPartIntakeResponse | null>(null);
  protected readonly working = signal(false);
  protected readonly committing = signal(false);
  protected readonly committed = signal(false);

  protected readonly canPreview = computed(() => this.parsedRows().length > 0 && !this.working());
  protected readonly canCommit = computed(() =>
    (this.preview()?.createdCount ?? 0) > 0 && !this.committing() && !this.committed());

  private readonly resultByKey = computed(() => {
    const map = new Map<string, BulkPartIntakeRowResult>();
    for (const r of this.preview()?.results ?? []) {
      if (r.externalRowKey) map.set(r.externalRowKey, r);
    }
    return map;
  });

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => this.parseCsv(String(reader.result ?? ''));
    reader.onerror = () => this.parseErrors.set([this.translate.instant('parts.importPage.readFailed')]);
    reader.readAsText(file);
    input.value = '';
  }

  protected onPasteParse(): void {
    this.parseCsv(this.pasteControl.value);
  }

  private parseCsv(text: string): void {
    this.preview.set(null);
    this.committed.set(false);
    if (!text.trim()) {
      this.parsedRows.set([]);
      this.parseErrors.set([this.translate.instant('parts.importPage.noContent')]);
      return;
    }
    const result: ParseResult<CsvParseRow> = parse<CsvParseRow>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase(),
    });

    const errors: string[] = [];
    if (result.errors?.length) {
      for (const err of result.errors.slice(0, 5)) errors.push(`Row ${err.row}: ${err.message}`);
    }

    const dataRows = (result.data ?? []).filter(raw => Object.values(raw).some(v => String(v ?? '').trim() !== ''));
    const rows: BulkPartIntakeRow[] = dataRows.map((raw, idx) => ({
      externalRowKey: `r${idx + 1}`,
      name: pick(raw, 'name', 'part', 'partname', 'part name', 'part_name', 'title') ?? '',
      description: pick(raw, 'description', 'desc', 'notes', 'note'),
      procurementSource: pick(raw, 'procurementsource', 'procurement', 'source', 'make/buy', 'makebuy', 'make buy'),
      inventoryClass: pick(raw, 'inventoryclass', 'inventory class', 'class', 'category', 'type'),
      externalId: pick(raw, 'externalid', 'external id', 'partnumber', 'part number', 'part#', 'part #', 'mpn', 'sku', 'number'),
    }));
    if (rows.length === 0) errors.push(this.translate.instant('parts.importPage.noDataRows'));

    this.parsedRows.set(rows);
    this.parseErrors.set(errors);
  }

  protected runPreview(): void {
    this.working.set(true);
    this.service.bulkIntakePreview({ rows: this.parsedRows() }).subscribe({
      next: (resp) => { this.preview.set(resp); this.working.set(false); },
      error: () => this.working.set(false),
    });
  }

  protected commit(): void {
    this.committing.set(true);
    this.service.bulkIntakeCommit({ rows: this.parsedRows() }).subscribe({
      next: (resp) => {
        this.committing.set(false);
        this.committed.set(true);
        this.preview.set(resp);
        this.snackbar.success(this.translate.instant('parts.importPage.committed', {
          created: resp.createdCount, total: resp.totalRows,
        }));
      },
      error: () => this.committing.set(false),
    });
  }

  protected statusChipClass(status: BulkPartIntakeRowStatus): string {
    switch (status) {
      case 'Created': return 'chip chip--success';
      case 'DuplicateWithinBatch':
      case 'DuplicateExistingPart': return 'chip chip--warning';
      case 'Invalid': return 'chip chip--muted';
      default: return 'chip';
    }
  }

  protected statusLabel(status: BulkPartIntakeRowStatus): string {
    if (status === 'Created' && this.committed()) return this.translate.instant('parts.importPage.importedStatus');
    return this.translate.instant(`parts.importPage.status.${status}`);
  }

  protected viewParts(): void {
    this.router.navigate(['/parts']);
  }

  protected resultFor(rowKey: string): BulkPartIntakeRowResult | undefined {
    return this.resultByKey().get(rowKey);
  }

  protected reset(): void {
    this.parsedRows.set([]);
    this.parseErrors.set([]);
    this.preview.set(null);
    this.committed.set(false);
    this.pasteControl.setValue('');
  }
}

function pick(row: CsvParseRow, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return undefined;
}
