import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { parse, ParseResult } from 'papaparse';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LeadsService } from '../../services/leads.service';
import {
  BulkLeadIntakeRequest,
  BulkLeadIntakeResponse,
  BulkLeadIntakeRow,
  BulkLeadIntakeRowResult,
  BulkLeadIntakeRowStatus,
  BulkLeadIntakeStrategy,
} from '../../models/bulk-intake.model';

interface CsvParseRow {
  [key: string]: string | undefined;
}

/**
 * Phase 1r / Batch 4 — bulk lead intake. Operator picks a strategy
 * (cold-call / cold-email / etc.), uploads a CSV (or pastes
 * comma-/tab-separated rows), the page parses + sends to the
 * preview endpoint, then renders a per-row status table with chips
 * indicating Created / DuplicateExistingLead / SuppressedOptOut /
 * InCooldown / MissingRequiredField. The commit button re-sends
 * the same payload to the commit endpoint, which inserts the
 * Created rows.
 *
 * Column-name aliases on parse: companyname/company → companyName,
 * contactname/contact/name → contactName, email/email-address →
 * email, phone/phone-number/tel → phone, source → source,
 * notes/comment → notes. Anything else is ignored.
 */
@Component({
  selector: 'app-leads-intake',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    PageHeaderComponent, InputComponent, SelectComponent, TextareaComponent,
    LoadingBlockDirective, EmptyStateComponent,
  ],
  templateUrl: './leads-intake.component.html',
  styleUrl: './leads-intake.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadsIntakeComponent {
  private readonly leadsService = inject(LeadsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly router = inject(Router);
  protected readonly translate = inject(TranslateService);

  protected readonly strategyControl = new FormControl<BulkLeadIntakeStrategy>('ColdCall', { nonNullable: true });
  protected readonly campaignTagControl = new FormControl<string>('', { nonNullable: true });
  protected readonly pasteControl = new FormControl<string>('', { nonNullable: true });

  protected readonly strategyOptions: SelectOption[] = [
    { value: 'ColdCall', label: this.translate.instant('leads.intake.strategy.coldCall') },
    { value: 'ColdEmail', label: this.translate.instant('leads.intake.strategy.coldEmail') },
    { value: 'TradeShowFollowup', label: this.translate.instant('leads.intake.strategy.tradeShow') },
    { value: 'WebinarAttendee', label: this.translate.instant('leads.intake.strategy.webinar') },
    { value: 'ListPurchase', label: this.translate.instant('leads.intake.strategy.listPurchase') },
    { value: 'ManualEntry', label: this.translate.instant('leads.intake.strategy.manual') },
  ];

  protected readonly parsedRows = signal<BulkLeadIntakeRow[]>([]);
  protected readonly parseErrors = signal<string[]>([]);
  protected readonly preview = signal<BulkLeadIntakeResponse | null>(null);
  protected readonly working = signal(false);
  protected readonly committing = signal(false);

  protected readonly canPreview = computed(() => this.parsedRows().length > 0);
  protected readonly canCommit = computed(() => (this.preview()?.createdCount ?? 0) > 0 && !this.committing());

  /**
   * Per-row status indexed by externalRowKey. Lets the table render
   * each parsed row with its status chip without an O(n*m) lookup.
   */
  protected readonly resultByKey = computed(() => {
    const map = new Map<string, BulkLeadIntakeRowResult>();
    for (const r of this.preview()?.results ?? []) map.set(r.externalRowKey, r);
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
    // Allow re-uploading the same file
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

    const rows: BulkLeadIntakeRow[] = (result.data ?? []).map((raw, idx) => {
      const company = pick(raw, 'companyname', 'company', 'company name', 'company_name');
      const contact = pick(raw, 'contactname', 'contact', 'name', 'contact name', 'contact_name');
      const email = pick(raw, 'email', 'email address', 'email_address', 'e-mail');
      const phone = pick(raw, 'phone', 'phone number', 'phone_number', 'tel', 'telephone');
      const source = pick(raw, 'source', 'lead source', 'lead_source');
      const notes = pick(raw, 'notes', 'note', 'comment', 'comments');
      return {
        externalRowKey: `r${idx + 1}`,
        companyName: company ?? '',
        contactName: contact,
        email,
        phone,
        source,
        notes,
      };
    }).filter(r => r.companyName || r.email || r.phone);

    this.parsedRows.set(rows);
    this.parseErrors.set(errors);
  }

  protected runPreview(): void {
    const request: BulkLeadIntakeRequest = {
      strategy: this.strategyControl.value,
      campaignTag: this.campaignTagControl.value.trim() || undefined,
      rows: this.parsedRows(),
    };
    this.working.set(true);
    this.leadsService.bulkIntakePreview(request).subscribe({
      next: (resp) => {
        this.preview.set(resp);
        this.working.set(false);
      },
      error: () => this.working.set(false),
    });
  }

  protected commit(): void {
    const request: BulkLeadIntakeRequest = {
      strategy: this.strategyControl.value,
      campaignTag: this.campaignTagControl.value.trim() || undefined,
      rows: this.parsedRows(),
    };
    this.committing.set(true);
    this.leadsService.bulkIntakeCommit(request).subscribe({
      next: (resp) => {
        this.committing.set(false);
        this.preview.set(resp);
        this.snackbar.success(this.translate.instant('leads.intake.committed', {
          created: resp.createdCount, total: resp.totalRows,
        }));
        if (resp.createdCount > 0) {
          // Brief delay so the operator sees the snackbar before bouncing
          setTimeout(() => this.router.navigate(['/leads']), 1200);
        }
      },
      error: () => this.committing.set(false),
    });
  }

  protected statusChipClass(status: BulkLeadIntakeRowStatus): string {
    switch (status) {
      case 'Created': return 'chip chip--success';
      case 'DuplicateExistingLead':
      case 'DuplicateExistingContact':
      case 'DuplicateWithinBatch': return 'chip chip--warning';
      case 'SuppressedOptOut':
      case 'InCooldown': return 'chip chip--error';
      case 'MissingRequiredField':
      case 'Invalid': return 'chip chip--muted';
      default: return 'chip';
    }
  }

  protected statusLabel(status: BulkLeadIntakeRowStatus): string {
    return this.translate.instant(`leads.intake.status.${status}`);
  }

  protected resultFor(rowKey: string): BulkLeadIntakeRowResult | undefined {
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
