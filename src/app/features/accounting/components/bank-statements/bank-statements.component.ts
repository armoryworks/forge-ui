import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';

import { BankStatementService } from '../../services/bank-statement.service';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import {
  BankStatementImportModel,
  BankStatementLineModel,
} from '../../models/accounting.models';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

const DEFAULT_BOOK_ID = 1;

// ⚡ BANK-001 — import OFX/CSV bank statements, review auto-match suggestions, confirm to clear
// the matched journal lines in the open bank reconciliation (settlement attestation).
@Component({
  selector: 'app-bank-statements',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, CurrencyPipe, DatePipe, MatTooltipModule,
    PageHeaderComponent, SelectComponent, DataTableComponent, ColumnCellDirective,
    LoadingBlockDirective,
  ],
  templateUrl: './bank-statements.component.html',
  styleUrl: './bank-statements.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankStatementsComponent {
  private readonly statementService = inject(BankStatementService);
  private readonly glService = inject(GeneralLedgerService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  @ViewChild('fileInput') private fileInput!: ElementRef<HTMLInputElement>;

  protected readonly cashAccountControl = new FormControl<number | null>(null);
  protected readonly cashAccountOptions = signal<SelectOption[]>([]);

  protected readonly importsLoading = signal(false);
  protected readonly imports = signal<BankStatementImportModel[]>([]);
  protected readonly importing = signal(false);

  protected readonly selectedImport = signal<BankStatementImportModel | null>(null);
  protected readonly linesLoading = signal(false);
  protected readonly lines = signal<BankStatementLineModel[]>([]);

  protected readonly importColumns: ColumnDef[] = [
    { field: 'fileName', header: this.translate.instant('accounting.bankStatements.file'), sortable: true },
    { field: 'format', header: this.translate.instant('accounting.bankStatements.format'), width: '80px' },
    { field: 'lineCount', header: this.translate.instant('accounting.bankStatements.lines'), width: '70px', align: 'right' },
    { field: 'duplicateCount', header: this.translate.instant('accounting.bankStatements.duplicates'), width: '90px', align: 'right' },
    { field: 'matchState', header: this.translate.instant('accounting.bankStatements.matchState'), width: '230px' },
    { field: 'createdAt', header: this.translate.instant('accounting.bankStatements.imported'), sortable: true, type: 'date', width: '110px' },
  ];

  protected readonly lineColumns: ColumnDef[] = [
    { field: 'postedDate', header: this.translate.instant('common.date'), sortable: true, width: '100px' },
    { field: 'description', header: this.translate.instant('common.description') },
    { field: 'amount', header: this.translate.instant('payables.amount'), sortable: true, width: '110px', align: 'right' },
    { field: 'matchStatus', header: this.translate.instant('common.status'), sortable: true, width: '110px' },
    { field: 'matched', header: this.translate.instant('accounting.bankStatements.matchedEntry'), width: '220px' },
    { field: 'actions', header: this.translate.instant('common.actions'), width: '120px', align: 'right' },
  ];

  constructor() {
    this.glService.getCashAccounts(DEFAULT_BOOK_ID).pipe(takeUntilDestroyed()).subscribe({
      next: (accounts) => {
        this.cashAccountOptions.set(
          accounts.map(a => ({ value: a.glAccountId, label: `${a.accountNumber} — ${a.name}` })));
        if (accounts.length > 0 && this.cashAccountControl.value === null) {
          this.cashAccountControl.setValue(accounts[0].glAccountId);
        }
      },
    });

    this.cashAccountControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.loadImports());

    this.loadImports();
  }

  protected pickFile(): void {
    if (!this.cashAccountControl.value) {
      this.snackbar.error(this.translate.instant('accounting.bankStatements.pickAccountFirst'));
      return;
    }
    this.fileInput.nativeElement.click();
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const cashGlAccountId = this.cashAccountControl.value;
    if (!file || !cashGlAccountId) return;

    this.importing.set(true);
    this.statementService.import(DEFAULT_BOOK_ID, cashGlAccountId, file).subscribe({
      next: (result) => {
        this.importing.set(false);
        this.snackbar.success(this.translate.instant('accounting.bankStatements.importResult', {
          imported: result.imported, duplicates: result.duplicates, suggested: result.suggested,
        }));
        this.loadImports(result.importId);
      },
      error: () => this.importing.set(false),
    });
  }

  protected loadImports(selectImportId?: number): void {
    this.importsLoading.set(true);
    const cashGlAccountId = this.cashAccountControl.value ?? undefined;
    this.statementService.getImports(cashGlAccountId).subscribe({
      next: (list) => {
        this.imports.set(list);
        this.importsLoading.set(false);
        const toSelect = selectImportId ?? this.selectedImport()?.id;
        const match = list.find(i => i.id === toSelect);
        if (match) this.selectImport(match);
      },
      error: () => this.importsLoading.set(false),
    });
  }

  protected selectImport(item: BankStatementImportModel): void {
    this.selectedImport.set(item);
    this.loadLines();
  }

  protected loadLines(): void {
    const selected = this.selectedImport();
    if (!selected) return;
    this.linesLoading.set(true);
    this.statementService.getLines(selected.id).subscribe({
      next: (list) => { this.lines.set(list); this.linesLoading.set(false); },
      error: () => this.linesLoading.set(false),
    });
  }

  protected autoMatch(): void {
    const selected = this.selectedImport();
    if (!selected) return;
    this.statementService.autoMatch(selected.id).subscribe({
      next: (suggested) => {
        this.snackbar.success(this.translate.instant('accounting.bankStatements.autoMatched', { suggested }));
        this.loadImports(selected.id);
      },
    });
  }

  protected confirmLine(line: BankStatementLineModel): void {
    this.statementService.confirm(line.id).subscribe({
      next: () => this.loadImports(this.selectedImport()?.id),
    });
  }

  protected ignoreLine(line: BankStatementLineModel): void {
    this.statementService.ignore(line.id).subscribe({
      next: () => this.loadImports(this.selectedImport()?.id),
    });
  }

  protected unmatchLine(line: BankStatementLineModel): void {
    this.statementService.unmatch(line.id).subscribe({
      next: () => this.loadImports(this.selectedImport()?.id),
    });
  }

  protected getMatchChipClass(status: string): string {
    const map: Record<string, string> = {
      Unmatched: 'chip--warning',
      Suggested: 'chip--info',
      Confirmed: 'chip--success',
      Ignored: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getMatchLabel(status: string): string {
    const key = 'accounting.bankStatements.status' + status;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
  }
}
