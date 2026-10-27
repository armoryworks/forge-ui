import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { PayRunService } from '../../services/pay-run.service';
import { PayrollRegisterImportResult } from '../../models/payroll-register-import-result.model';
import { PayrollRegisterPreview } from '../../models/payroll-register-preview.model';
import { PayrollRegisterPreviewRow } from '../../models/payroll-register-preview-row.model';
import { pickFile } from '../../utils/pick-file';

export interface PayrollImportDialogData {
  bookId: number;
}

/** One register category with the headers that fed it, for the mapping preview. */
interface ColumnMappingRow {
  category: string;
  headers: string;
}

const CATEGORY_ORDER = ['employee', 'gross', 'federal', 'state', 'ficaEmployee', 'otherDeductions', 'employerTax', 'net'];

/**
 * PAY-001 payroll register import: pick the provider's per-employee CSV, review how its headers map to each
 * category and the parsed rows (net mismatches flagged), then import it as a Draft pay run for the pay date
 * and period. Problems that stop the import are listed and block the button. Closes with the import result.
 */
@Component({
  selector: 'app-payroll-import-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, CurrencyPipe, DialogComponent, DatepickerComponent, ValidationButtonComponent,
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
  ],
  templateUrl: './payroll-import-dialog.component.html',
  styleUrl: './payroll-import-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PayrollImportDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<PayrollImportDialogComponent, PayrollRegisterImportResult | undefined>);
  private readonly payRuns = inject(PayRunService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly data = inject<PayrollImportDialogData>(MAT_DIALOG_DATA);

  protected readonly form = new FormGroup({
    payDate: new FormControl<Date | null>(null, [Validators.required]),
    periodStart: new FormControl<Date | null>(null, [Validators.required]),
    periodEnd: new FormControl<Date | null>(null, [Validators.required]),
  });
  protected readonly violations = FormValidationService.getViolations(this.form, {
    payDate: this.translate.instant('accounting.payRuns.payDate'),
    periodStart: this.translate.instant('accounting.payRuns.periodStart'),
    periodEnd: this.translate.instant('accounting.payRuns.periodEnd'),
  });

  protected readonly rowColumns: ColumnDef[] = [
    { field: 'employeeName', header: this.translate.instant('accounting.payRuns.employee') },
    { field: 'gross', header: this.translate.instant('accounting.payRuns.gross'), align: 'right', width: '110px' },
    { field: 'withholdings', header: this.translate.instant('accounting.payRuns.withholdings'), align: 'right', width: '110px' },
    { field: 'employerTax', header: this.translate.instant('accounting.payRuns.employerTax'), align: 'right', width: '110px' },
    { field: 'reportedNet', header: this.translate.instant('accounting.payRuns.net'), align: 'right', width: '170px' },
  ];
  protected readonly rowClass = (row: unknown): string =>
    (row as PayrollRegisterPreviewRow).netMismatch ? 'row--mismatch' : '';

  protected readonly file = signal<File | null>(null);
  protected readonly previewing = signal(false);
  protected readonly importing = signal(false);
  protected readonly preview = signal<PayrollRegisterPreview | null>(null);

  protected readonly mapping = computed<ColumnMappingRow[]>(() => {
    const columns = this.preview()?.columns ?? {};
    return CATEGORY_ORDER.map((category) => ({
      category,
      headers: (columns[category] ?? []).join(', '),
    }));
  });
  protected readonly problems = computed(() =>
    (this.preview()?.errors ?? []).map((code) => this.translate.instant(`accounting.payRuns.errors.${code}`)));
  protected readonly mismatchCount = computed(() => (this.preview()?.rows ?? []).filter((r) => r.netMismatch).length);
  protected readonly canImport = computed(() => {
    const preview = this.preview();
    return !!preview && preview.errors.length === 0 && preview.rows.length > 0 && !this.importing();
  });

  protected chooseFile(): void {
    pickFile('.csv,text/csv', (file) => this.loadPreview(file));
  }

  protected import(): void {
    const file = this.file();
    if (!file || this.form.invalid || !this.canImport()) return;
    const raw = this.form.getRawValue();
    this.importing.set(true);
    this.payRuns
      .importRegister(this.data.bookId, this.day(raw.payDate), this.day(raw.periodStart), this.day(raw.periodEnd), file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.importing.set(false);
          this.dialogRef.close(result);
        },
        error: () => this.importing.set(false),
      });
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected loadPreview(file: File): void {
    this.file.set(file);
    this.preview.set(null);
    this.previewing.set(true);
    this.payRuns.previewRegister(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (preview) => {
          this.preview.set(preview);
          this.previewing.set(false);
        },
        error: (err: unknown) => {
          this.previewing.set(false);
          this.snackbar.errorFrom(err, 'accounting.payRuns.previewFailed');
        },
      });
  }

  private day(date: Date | null): string {
    return (toIsoDate(date) ?? '').slice(0, 10);
  }
}
