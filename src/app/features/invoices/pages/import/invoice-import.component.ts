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
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { parseCsvDate, parseCsvNumber, parseCsvText, pickCsv } from '../../../../shared/utils/csv-import';
import { downloadCsv } from '../../../../shared/utils/download-csv';
import { InvoiceImportService } from '../../services/invoice-import.service';
import { InvoiceImportRow } from '../../models/invoice-import-row.model';

interface InvoiceImportDisplayRow extends InvoiceImportRow {
  id: string;
  rowNumber: number;
  result: DataImportRowResult | null;
}

/**
 * Historical invoice CSV import: one row per invoice line (rows sharing an invoice number are one invoice),
 * validated as a dry run and then imported all at once with their numbers kept. Imported invoices and their
 * paid amounts never post to the general ledger; with full GL on, the opening AR balance comes from the
 * opening-balance journal, which the page says up front.
 */
@Component({
  selector: 'app-invoice-import-page',
  standalone: true,
  imports: [TranslatePipe, PageLayoutComponent, CsvImportSourceComponent, DataTableComponent, ColumnCellDirective, LoadingBlockDirective],
  templateUrl: './invoice-import.component.html',
  styleUrl: './invoice-import.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceImportPageComponent {
  private readonly service = inject(InvoiceImportService);
  private readonly snackbar = inject(SnackbarService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly capability = inject(CapabilityService);

  protected readonly fullGl = computed(() => this.capability.isEnabled('CAP-ACCT-FULLGL'));
  protected readonly rows = signal<InvoiceImportRow[]>([]);
  protected readonly parseErrors = signal<string[]>([]);
  protected readonly result = signal<DataImportResult | null>(null);
  protected readonly working = signal(false);

  protected readonly invoiceCount = computed(() => new Set(this.rows().map(r => r.invoiceNumber ?? '')).size);
  protected readonly canValidate = computed(() => this.rows().length > 0 && this.parseErrors().length === 0 && !this.working());
  protected readonly canCommit = computed(() => {
    const r = this.result();
    return !!r && !r.committed && r.invalidCount === 0 && r.validCount > 0 && !this.working();
  });

  protected readonly displayRows = computed<InvoiceImportDisplayRow[]>(() => {
    const byKey = new Map((this.result()?.rows ?? []).map(r => [r.rowKey ?? '', r]));
    return this.rows().map((row, i) => ({ ...row, id: row.rowKey, rowNumber: i + 1, result: byKey.get(row.rowKey) ?? null }));
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'rowNumber', header: '#', width: '56px', align: 'right' },
    { field: 'invoiceNumber', header: this.translate.instant('invoiceImport.colNumber'), width: '120px' },
    { field: 'customer', header: this.translate.instant('invoiceImport.colCustomer') },
    { field: 'invoiceDate', header: this.translate.instant('invoiceImport.colDate'), width: '110px' },
    { field: 'description', header: this.translate.instant('invoiceImport.colLine') },
    { field: 'total', header: this.translate.instant('invoiceImport.colTotal'), width: '110px', align: 'right' },
    { field: 'paidAmount', header: this.translate.instant('invoiceImport.colPaid'), width: '110px', align: 'right' },
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
        if (r.committed) this.snackbar.success(this.translate.instant('invoiceImport.committed', { count: r.createdCount }));
      },
      error: () => this.working.set(false),
    });
  }

  protected downloadTemplate(): void {
    downloadCsv([
      ['Invoice Number', 'Customer', 'Invoice Date', 'Due Date', 'Part', 'Description', 'Quantity', 'Unit Price', 'Tax', 'Total', 'Paid Amount', 'Paid Date', 'Status', 'Customer PO'],
      ['INV-2025-0101', 'C-00012', '2025-11-03', '2025-12-03', 'BRK-100', 'Brackets', '100', '4.50', '32.63', '482.63', '482.63', '2025-11-28', 'Paid', 'PO-4410'],
      ['INV-2025-0102', 'C-00012', '2025-12-01', '2025-12-31', '', 'Setup charge', '1', '150.00', '0', '150.00', '0', '', 'Open', ''],
    ], 'invoice-import-template');
  }

  protected viewInvoices(): void {
    this.router.navigate(['/invoices']);
  }

  protected statusClass(row: InvoiceImportDisplayRow): string {
    switch (row.result?.status) {
      case 'Created': return 'chip chip--success';
      case 'Valid': return 'chip chip--info';
      case 'Invalid': return 'chip chip--error';
      default: return 'chip chip--muted';
    }
  }

  private toRow(r: CsvRecord, index: number, errors: string[]): InvoiceImportRow {
    const rowNumber = index + 1;
    const num = (field: string, ...keys: string[]): number | null => {
      const value = parseCsvNumber(pickCsv(r, ...keys));
      if (Number.isNaN(value)) {
        errors.push(this.translate.instant('csvImport.badNumber', { row: rowNumber, field }));
        return null;
      }
      return value;
    };
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
      invoiceNumber: pickCsv(r, 'invoice number', 'invoicenumber', 'invoice #', 'invoice#', 'invoice', 'number', 'inv') ?? null,
      customer: pickCsv(r, 'customer', 'customer number', 'customer #', 'customer name', 'client', 'bill to') ?? null,
      invoiceDate: date('Invoice Date', 'invoice date', 'invoicedate', 'date'),
      dueDate: date('Due Date', 'due date', 'duedate', 'due'),
      part: pickCsv(r, 'part', 'part number', 'partnumber', 'item', 'sku') ?? null,
      description: pickCsv(r, 'description', 'line description', 'memo') ?? null,
      quantity: num('Quantity', 'quantity', 'qty'),
      unitPrice: num('Unit Price', 'unit price', 'unitprice', 'price', 'rate'),
      tax: num('Tax', 'tax', 'tax amount', 'sales tax'),
      total: num('Total', 'total', 'invoice total', 'amount'),
      paidAmount: num('Paid Amount', 'paid amount', 'paidamount', 'paid', 'amount paid'),
      paidDate: date('Paid Date', 'paid date', 'paiddate', 'payment date'),
      status: pickCsv(r, 'status') ?? null,
      customerPO: pickCsv(r, 'customer po', 'customerpo', 'po', 'po number', 'purchase order') ?? null,
    };
  }
}
