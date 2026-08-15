import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { ToggleComponent } from '../../../shared/components/toggle/toggle.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { DatabaseTransferService } from '../services/database-transfer.service';
import { DatabaseTransferSummary } from './models/database-transfer-summary.model';
import { DatabaseImportReport } from './models/database-import-report.model';

/**
 * Admin database transfer — the UI face of the clean-rebuild workflow (forge-db DESIGN §6.2).
 * Export streams the full data dump as a zip (same layout as `forge-db dump`, so archives are
 * interchangeable with the CLI); Import loads such a zip into THIS install, truncating and
 * reloading the selected tables — garbage is cleaned via exclude globs, an optional soft-deleted
 * purge, and the FK-orphan report. Admin-only (server-enforced) and double-confirmed here.
 */
@Component({
  selector: 'app-database-transfer',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DecimalPipe,
    PageLayoutComponent, InputComponent, ToggleComponent,
  ],
  templateUrl: './database-transfer.component.html',
  styleUrl: './database-transfer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatabaseTransferComponent implements OnInit {
  private readonly transferService = inject(DatabaseTransferService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly summary = signal<DatabaseTransferSummary | null>(null);
  protected readonly dumping = signal(false);
  protected readonly importing = signal(false);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly report = signal<DatabaseImportReport | null>(null);

  protected readonly totalMib = computed(() => (this.summary()?.totalBytes ?? 0) / (1024 * 1024));
  protected readonly busy = computed(() => this.dumping() || this.importing());

  protected readonly excludePatterns = new FormControl<string>('', { nonNullable: true });
  protected readonly purgeSoftDeleted = new FormControl<boolean>(true, { nonNullable: true });
  protected readonly allowFkOrphans = new FormControl<boolean>(false, { nonNullable: true });

  ngOnInit(): void {
    this.transferService.getSummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected downloadDump(): void {
    if (this.busy()) return;
    this.dumping.set(true);
    this.transferService.downloadDump()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `forge-dump-${new Date().toISOString().slice(0, 10)}.zip`;
          anchor.click();
          URL.revokeObjectURL(url);
          this.dumping.set(false);
          this.snackbar.success(this.translate.instant('adminDatabase.export.done'));
        },
        error: () => this.dumping.set(false),
      });
  }

  protected onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
    this.report.set(null);
  }

  protected confirmImport(): void {
    const file = this.selectedFile();
    if (!file || this.busy()) return;

    this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      data: {
        title: this.translate.instant('adminDatabase.import.confirmTitle'),
        message: this.translate.instant('adminDatabase.import.confirmMessage', { file: file.name }),
        confirmLabel: this.translate.instant('adminDatabase.import.confirmLabel'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) this.runImport(file);
      });
  }

  private runImport(file: File): void {
    this.importing.set(true);
    this.report.set(null);
    this.transferService.importDump(file, {
      excludePatterns: this.excludePatterns.value.trim(),
      purgeSoftDeleted: this.purgeSoftDeleted.value,
      allowFkOrphans: this.allowFkOrphans.value,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => {
          this.report.set(report);
          this.importing.set(false);
          if (report.success) {
            this.snackbar.success(this.translate.instant('adminDatabase.import.done'));
          }
        },
        error: () => this.importing.set(false),
      });
  }
}
