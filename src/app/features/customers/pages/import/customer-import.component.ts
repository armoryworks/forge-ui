import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { parse, ParseResult } from 'papaparse';

import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CustomerService } from '../../services/customer.service';
import {
  BulkCustomerIntakeResponse,
  BulkCustomerIntakeRow,
  BulkCustomerIntakeRowResult,
  BulkCustomerIntakeRowStatus,
} from '../../models/bulk-customer-intake.model';

interface CsvParseRow {
  [key: string]: string | undefined;
}

/**
 * C2 — customer bulk import. Upload a CSV (or paste comma-/tab-separated rows), the page parses
 * + sends to the preview endpoint (classifies each row new / duplicate-in-batch / duplicate-existing
 * / invalid without persisting), renders a per-row status table, then commits the new rows.
 * Column aliases: name/customer/customername → name; company/companyname → companyName;
 * email → email; phone/tel → phone; notes/comment → notes.
 */
@Component({
  selector: 'app-customer-import-page',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, PageLayoutComponent, TextareaComponent, LoadingBlockDirective],
  templateUrl: './customer-import.component.html',
  styleUrl: './customer-import.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerImportPageComponent {
  private readonly service = inject(CustomerService);
  private readonly snackbar = inject(SnackbarService);
  private readonly router = inject(Router);
  protected readonly translate = inject(TranslateService);

  protected readonly pasteControl = new FormControl<string>('', { nonNullable: true });

  protected readonly parsedRows = signal<BulkCustomerIntakeRow[]>([]);
  protected readonly parseErrors = signal<string[]>([]);
  protected readonly preview = signal<BulkCustomerIntakeResponse | null>(null);
  protected readonly working = signal(false);
  protected readonly committing = signal(false);

  protected readonly canPreview = computed(() => this.parsedRows().length > 0 && !this.working());
  protected readonly canCommit = computed(() => (this.preview()?.createdCount ?? 0) > 0 && !this.committing());

  private readonly resultByKey = computed(() => {
    const map = new Map<string, BulkCustomerIntakeRowResult>();
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
    reader.onerror = () => this.parseErrors.set(['Failed to read file.']);
    reader.readAsText(file);
    input.value = '';
  }

  protected onPasteParse(): void {
    this.parseCsv(this.pasteControl.value);
  }

  private parseCsv(text: string): void {
    this.preview.set(null);
    if (!text.trim()) {
      this.parsedRows.set([]);
      this.parseErrors.set(['No content to parse.']);
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

    const rows: BulkCustomerIntakeRow[] = (result.data ?? []).map((raw, idx) => ({
      externalRowKey: `r${idx + 1}`,
      name: pick(raw, 'name', 'customer', 'customername', 'customer name', 'customer_name') ?? '',
      companyName: pick(raw, 'companyname', 'company', 'company name', 'company_name'),
      email: pick(raw, 'email', 'email address', 'email_address', 'e-mail'),
      phone: pick(raw, 'phone', 'phone number', 'phone_number', 'tel', 'telephone'),
      notes: pick(raw, 'notes', 'note', 'comment', 'comments'),
    })).filter(r => r.name);

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
        this.preview.set(resp);
        this.snackbar.success(this.translate.instant('customers.importPage.committed', {
          created: resp.createdCount, total: resp.totalRows,
        }));
        if (resp.createdCount > 0) {
          setTimeout(() => this.router.navigate(['/customers']), 1200);
        }
      },
      error: () => this.committing.set(false),
    });
  }

  protected statusChipClass(status: BulkCustomerIntakeRowStatus): string {
    switch (status) {
      case 'Created': return 'chip chip--success';
      case 'DuplicateWithinBatch':
      case 'DuplicateExistingCustomer': return 'chip chip--warning';
      case 'Invalid': return 'chip chip--muted';
      default: return 'chip';
    }
  }

  protected statusLabel(status: BulkCustomerIntakeRowStatus): string {
    return this.translate.instant(`customers.importPage.status.${status}`);
  }

  protected resultFor(rowKey: string): BulkCustomerIntakeRowResult | undefined {
    return this.resultByKey().get(rowKey);
  }

  protected reset(): void {
    this.parsedRows.set([]);
    this.parseErrors.set([]);
    this.preview.set(null);
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
