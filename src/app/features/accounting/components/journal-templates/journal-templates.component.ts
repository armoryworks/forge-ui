import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { JournalTemplate } from '../../models/journal-template.model';
import { JournalTemplateService } from '../../services/journal-template.service';
import { bookIdFromParams } from '../../utils/statement-period';

/**
 * Journal templates for recurring and standard entries (rent, accruals, allocations). Each template opens in its
 * editor, posts through the journal-entry editor pre-filled (so maker-checker and period rules apply), or is
 * deleted (posted entries stay). Controller, CAP-ACCT-FULLGL.
 */
@Component({
  selector: 'app-journal-templates',
  standalone: true,
  imports: [TranslatePipe, PageLayoutComponent, DataTableComponent, ColumnCellDirective, CurrencyDisplayComponent, LoadingBlockDirective],
  templateUrl: './journal-templates.component.html',
  styleUrl: './journal-templates.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JournalTemplatesComponent implements OnInit {
  private readonly service = inject(JournalTemplateService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly templates = signal<JournalTemplate[]>([]);
  private bookId = 1;

  protected readonly rows = computed(() =>
    this.templates().map((t) => ({
      ...t,
      lineCount: t.lines.length,
      fixedDebit: t.lines.reduce((sum, l) => sum + l.debit, 0),
      openLines: t.lines.filter((l) => !l.debit && !l.credit).length,
      stateLabel: this.translate.instant(t.isActive ? 'common.active' : 'common.inactive'),
      reverseLabel: this.translate.instant(t.autoReverseNextPeriod ? 'common.yes' : 'common.no'),
    })),
  );

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: this.translate.instant('accounting.journalTemplates.name'), sortable: true },
    { field: 'description', header: this.translate.instant('accounting.common.description'), phoneHidden: true },
    { field: 'lineCount', header: this.translate.instant('accounting.journalTemplates.lines'), type: 'number', align: 'right', width: '90px' },
    { field: 'fixedDebit', header: this.translate.instant('accounting.journalTemplates.fixedAmount'), type: 'number', align: 'right', width: '150px' },
    { field: 'reverseLabel', header: this.translate.instant('accounting.journalTemplates.autoReverse'), width: '130px', phoneHidden: true },
    { field: 'stateLabel', header: this.translate.instant('accounting.common.status'), sortable: true, width: '110px' },
    { field: 'actions', header: this.translate.instant('common.actions'), width: '200px', exportable: false },
  ];

  ngOnInit(): void {
    this.bookId = bookIdFromParams(this.route.snapshot.queryParamMap);
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.list(this.bookId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (templates) => {
        this.templates.set(templates);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.snackbar.errorFrom(err, 'accounting.journalTemplates.loadFailed');
      },
    });
  }

  protected create(): void {
    this.router.navigate(['/accounting/journal-templates/new']);
  }

  protected edit(template: JournalTemplate): void {
    this.router.navigate(['/accounting/journal-templates', template.id]);
  }

  protected post(template: JournalTemplate): void {
    if (!template.isActive) return;
    this.router.navigate(['/accounting/journal-entries/new'], { queryParams: { fromTemplate: template.id } });
  }

  protected remove(template: JournalTemplate): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: this.translate.instant('accounting.journalTemplates.deleteTitle'),
          message: this.translate.instant('accounting.journalTemplates.deleteMessage', { name: template.name }),
          confirmLabel: this.translate.instant('common.delete'),
          severity: 'danger',
        } satisfies ConfirmDialogData,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.service.delete(template.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => {
            this.snackbar.success(this.translate.instant('accounting.journalTemplates.deleted', { name: template.name }));
            this.load();
          },
          error: (err: unknown) => this.snackbar.errorFrom(err, 'accounting.journalTemplates.deleteFailed'),
        });
      });
  }
}
