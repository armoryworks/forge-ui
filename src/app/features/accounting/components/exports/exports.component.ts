import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { format } from 'date-fns';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import {
  DateRange,
  DateRangePickerComponent,
} from '../../../../shared/components/date-range-picker/date-range-picker.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { CapDirective } from '../../../../shared/directives/cap.directive';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AccountingExportService, CsvExportKind } from '../../services/accounting-export.service';
import { QboAccountMapping } from '../../models/qbo-account-mapping.model';

/** Default book — single-book Phase 2/3; a book selector arrives with multi-book support. */
const DEFAULT_BOOK_ID = 1;

const QBO_PUSH_OVERLAP = 'qbo-push-overlap';

function isQboOverlap(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 409
    && (err.error as { code?: unknown } | null)?.code === QBO_PUSH_OVERLAP;
}

function problemDetail(err: unknown): string | null {
  const detail = err instanceof HttpErrorResponse ? (err.error as { detail?: unknown } | null)?.detail : null;
  return typeof detail === 'string' && detail.length > 0 ? detail : null;
}

/** One QBO mapping-editor row: the server row plus its per-row edit control. */
interface QboMappingRow {
  mapping: QboAccountMapping;
  control: FormControl<string>;
}

/**
 * QB-001 — the CPA exports screen: always-available CSV downloads (trial
 * balance, GL detail, journal summary) over a date range, plus — only when
 * CAP-ACCT-QBO-EXPORT is on — the GL→QBO account mapping editor and the
 * one-way "Push to QuickBooks" journal-summary push. QuickBooks is never the
 * system of record; nothing on this screen reads back from it.
 */
@Component({
  selector: 'app-accounting-exports',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    PageHeaderComponent,
    InputComponent,
    DateRangePickerComponent,
    CapDirective,
  ],
  templateUrl: './exports.component.html',
  styleUrl: './exports.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportsComponent implements OnInit {
  private readonly exportService = inject(AccountingExportService);
  private readonly capabilities = inject(CapabilityService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  /** Month-to-date default range. */
  protected readonly rangeControl = new FormControl<DateRange>(
    {
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      end: new Date(),
    },
    { nonNullable: true },
  );

  protected readonly downloading = signal<CsvExportKind | null>(null);
  protected readonly error = signal<string | null>(null);

  // ── QBO push state (rendered only behind CAP-ACCT-QBO-EXPORT) ──
  protected readonly mappingRows = signal<QboMappingRow[]>([]);
  protected readonly mappingsLoading = signal(false);
  protected readonly savingAccountId = signal<number | null>(null);
  protected readonly pushBusy = signal(false);

  ngOnInit(): void {
    if (this.capabilities.isEnabled('CAP-ACCT-QBO-EXPORT')) {
      this.loadMappings();
    }
  }

  protected download(kind: CsvExportKind): void {
    if (this.rangeControl.invalid) return;
    this.downloading.set(kind);
    this.error.set(null);
    this.exportService
      .downloadCsv(kind, DEFAULT_BOOK_ID, this.fromParam(), this.toParam())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.downloading.set(null);
          this.saveBlob(response.body, this.fileNameOf(response.headers.get('content-disposition'), kind));
        },
        error: () => {
          this.downloading.set(null);
          this.error.set(this.translate.instant('accounting.exports.downloadFailed'));
        },
      });
  }

  protected saveMapping(row: QboMappingRow): void {
    const qboId = row.control.value.trim();
    if (!qboId) return;

    this.savingAccountId.set(row.mapping.glAccountId);
    this.exportService
      .upsertQboMapping(row.mapping.glAccountId, qboId, row.mapping.qboAccountName)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.savingAccountId.set(null);
          this.snackbar.success(this.translate.instant('accounting.exports.mappingSaved'));
          this.loadMappings();
        },
        error: () => this.savingAccountId.set(null),
      });
  }

  protected removeMapping(row: QboMappingRow): void {
    this.savingAccountId.set(row.mapping.glAccountId);
    this.exportService
      .deleteQboMapping(row.mapping.glAccountId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.savingAccountId.set(null);
          this.snackbar.success(this.translate.instant('accounting.exports.mappingRemoved'));
          this.loadMappings();
        },
        error: () => this.savingAccountId.set(null),
      });
  }

  protected confirmPush(): void {
    if (this.rangeControl.invalid) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: this.translate.instant('accounting.exports.pushConfirmTitle'),
          message: this.translate.instant('accounting.exports.pushConfirmMessage', {
            from: this.fromParam() ?? '…',
            to: this.toParam() ?? '…',
          }),
          confirmLabel: this.translate.instant('accounting.exports.pushConfirmLabel'),
          severity: 'warn',
        } satisfies ConfirmDialogData,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) this.push();
      });
  }

  private push(force = false): void {
    const from = this.fromParam();
    const to = this.toParam();
    if (!from || !to) {
      this.error.set(this.translate.instant('accounting.exports.rangeRequired'));
      return;
    }

    this.pushBusy.set(true);
    this.error.set(null);
    this.exportService
      .pushToQbo(DEFAULT_BOOK_ID, from, to, force)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.pushBusy.set(false);
          this.snackbar.success(
            this.translate.instant('accounting.exports.pushSuccess', { docId: result.qboDocId }),
          );
        },
        error: (err: unknown) => {
          this.pushBusy.set(false);
          if (!force && isQboOverlap(err)) {
            this.confirmForcedPush(from, to, problemDetail(err));
            return;
          }
          this.snackbar.errorFrom(err, 'accounting.exports.pushFailed');
        },
      });
  }

  private confirmForcedPush(from: string, to: string, detail: string | null): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '460px',
        data: {
          title: this.translate.instant('accounting.exports.overlapTitle'),
          message: this.translate.instant('accounting.exports.overlapMessage', { from, to }),
          details: detail ? [detail] : undefined,
          confirmLabel: this.translate.instant('accounting.exports.overlapConfirm'),
          severity: 'danger',
        } satisfies ConfirmDialogData,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) this.push(true);
      });
  }

  private loadMappings(): void {
    this.mappingsLoading.set(true);
    this.exportService
      .getQboMappings(DEFAULT_BOOK_ID)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (mappings) => {
          this.mappingsLoading.set(false);
          this.mappingRows.set(
            mappings.map((mapping) => ({
              mapping,
              control: new FormControl<string>(mapping.qboAccountId ?? '', { nonNullable: true }),
            })),
          );
        },
        error: () => {
          this.mappingsLoading.set(false);
          this.error.set(this.translate.instant('accounting.exports.mappingsLoadFailed'));
        },
      });
  }

  private saveBlob(blob: Blob | null, fileName: string): void {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  private fileNameOf(contentDisposition: string | null, kind: CsvExportKind): string {
    const match = contentDisposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    return match?.[1] ?? `${kind}.csv`;
  }

  private fromParam(): string | null {
    const start = this.rangeControl.value.start;
    return start ? format(start, 'yyyy-MM-dd') : null;
  }

  private toParam(): string | null {
    const end = this.rangeControl.value.end;
    return end ? format(end, 'yyyy-MM-dd') : null;
  }
}
