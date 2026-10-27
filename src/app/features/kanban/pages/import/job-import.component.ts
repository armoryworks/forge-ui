import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { CsvImportSourceComponent } from '../../../../shared/components/csv-import-source/csv-import-source.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { CsvRecord } from '../../../../shared/models/csv-record.model';
import { DataImportResult } from '../../../../shared/models/data-import-result.model';
import { DataImportRowResult } from '../../../../shared/models/data-import-row-result.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { parseCsvDate, parseCsvNumber, parseCsvText, pickCsv } from '../../../../shared/utils/csv-import';
import { downloadCsv } from '../../../../shared/utils/download-csv';
import { JobImportService } from '../../services/job-import.service';
import { JobImportRow } from '../../models/job-import-row.model';

interface JobImportDisplayRow extends JobImportRow {
  id: string;
  rowNumber: number;
  result: DataImportRowResult | null;
}

/**
 * Job CSV import: upload or paste rows, validate them (a dry run that reports each row's problems),
 * then import them all at once. Numbers in the file are kept; a blank number takes the next job number.
 * Customer and part match by number, then name; stage and track type by name or code.
 */
@Component({
  selector: 'app-job-import-page',
  standalone: true,
  imports: [TranslatePipe, PageLayoutComponent, CsvImportSourceComponent, DataTableComponent, ColumnCellDirective, LoadingBlockDirective],
  templateUrl: './job-import.component.html',
  styleUrl: './job-import.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobImportPageComponent {
  private readonly service = inject(JobImportService);
  private readonly snackbar = inject(SnackbarService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly rows = signal<JobImportRow[]>([]);
  protected readonly parseErrors = signal<string[]>([]);
  protected readonly result = signal<DataImportResult | null>(null);
  protected readonly working = signal(false);

  protected readonly canValidate = computed(() => this.rows().length > 0 && this.parseErrors().length === 0 && !this.working());
  protected readonly canCommit = computed(() => {
    const r = this.result();
    return !!r && !r.committed && r.invalidCount === 0 && r.validCount > 0 && !this.working();
  });

  protected readonly displayRows = computed<JobImportDisplayRow[]>(() => {
    const byKey = new Map((this.result()?.rows ?? []).map(r => [r.rowKey ?? '', r]));
    return this.rows().map((row, i) => ({ ...row, id: row.rowKey, rowNumber: i + 1, result: byKey.get(row.rowKey) ?? null }));
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'rowNumber', header: '#', width: '56px', align: 'right' },
    { field: 'jobNumber', header: this.translate.instant('jobImport.colNumber'), width: '130px' },
    { field: 'title', header: this.translate.instant('jobImport.colTitle') },
    { field: 'customer', header: this.translate.instant('jobImport.colCustomer') },
    { field: 'part', header: this.translate.instant('jobImport.colPart'), width: '140px' },
    { field: 'quantity', header: this.translate.instant('jobImport.colQuantity'), width: '90px', align: 'right' },
    { field: 'stage', header: this.translate.instant('jobImport.colStage'), width: '140px' },
    { field: 'status', header: this.translate.instant('csvImport.colStatus'), width: '260px' },
  ];

  protected load(text: string): void {
    this.result.set(null);
    if (!text.trim()) {
      this.rows.set([]);
      this.parseErrors.set([this.translate.instant('csvImport.noContent')]);
      return;
    }
    const { records, errors } = parseCsvText(text);
    const rows = records.map((r, i) => this.toRow(r, i, errors));
    if (rows.length === 0) errors.push(this.translate.instant('csvImport.noDataRows'));
    this.rows.set(rows);
    this.parseErrors.set(errors);
  }

  protected reset(): void {
    this.rows.set([]);
    this.parseErrors.set([]);
    this.result.set(null);
  }

  protected validate(): void {
    if (!this.canValidate()) return;
    this.working.set(true);
    this.service.validate(this.rows()).subscribe({
      next: (r) => { this.result.set(r); this.working.set(false); },
      error: () => this.working.set(false),
    });
  }

  protected commit(): void {
    if (!this.canCommit()) return;
    this.working.set(true);
    this.service.commit(this.rows()).subscribe({
      next: (r) => {
        this.result.set(r);
        this.working.set(false);
        if (r.committed) this.snackbar.success(this.translate.instant('jobImport.committed', { count: r.createdCount }));
      },
      error: () => this.working.set(false),
    });
  }

  protected downloadTemplate(): void {
    downloadCsv([
      ['Job Number', 'Title', 'Customer', 'Part', 'Quantity', 'Start Date', 'Due Date', 'Completed Date', 'Stage', 'Track Type', 'Priority', 'Customer PO', 'Description'],
      ['J-1001', 'Brackets run 1', 'C-00012', 'BRK-100', '250', '2026-01-05', '2026-01-30', '', 'In Production', '', 'Normal', 'PO-4410', ''],
    ], 'job-import-template');
  }

  protected viewJobs(): void {
    this.router.navigate(['/backlog']);
  }

  protected statusClass(row: JobImportDisplayRow): string {
    switch (row.result?.status) {
      case 'Created': return 'chip chip--success';
      case 'Valid': return 'chip chip--info';
      case 'Invalid': return 'chip chip--error';
      default: return 'chip chip--muted';
    }
  }

  private toRow(r: CsvRecord, index: number, errors: string[]): JobImportRow {
    const rowNumber = index + 1;
    const quantity = parseCsvNumber(pickCsv(r, 'quantity', 'qty'));
    if (Number.isNaN(quantity)) errors.push(this.translate.instant('csvImport.badNumber', { row: rowNumber, field: 'Quantity' }));
    const date = (field: string, ...keys: string[]): string | null => {
      const value = parseCsvDate(pickCsv(r, ...keys));
      if (value === undefined) {
        errors.push(this.translate.instant('csvImport.badDate', { row: rowNumber, field }));
        return null;
      }
      return value;
    };
    return {
      rowKey: `r${rowNumber}`,
      jobNumber: pickCsv(r, 'job number', 'jobnumber', 'job #', 'job#', 'job', 'work order', 'number') ?? null,
      title: pickCsv(r, 'title', 'job title', 'name') ?? null,
      customer: pickCsv(r, 'customer', 'customer number', 'customer #', 'customer name', 'client') ?? null,
      part: pickCsv(r, 'part', 'part number', 'partnumber', 'part #', 'item', 'sku') ?? null,
      quantity: Number.isNaN(quantity) ? null : quantity,
      startDate: date('Start Date', 'start date', 'startdate', 'start'),
      dueDate: date('Due Date', 'due date', 'duedate', 'due', 'ship date'),
      completedDate: date('Completed Date', 'completed date', 'completeddate', 'completed', 'closed date'),
      stage: pickCsv(r, 'stage', 'status') ?? null,
      trackType: pickCsv(r, 'track type', 'tracktype', 'track') ?? null,
      priority: pickCsv(r, 'priority') ?? null,
      customerPO: pickCsv(r, 'customer po', 'customerpo', 'po', 'po number', 'purchase order') ?? null,
      description: pickCsv(r, 'description', 'notes') ?? null,
    };
  }
}
