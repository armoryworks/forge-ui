import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { ToolbarComponent } from '../../../shared/components/toolbar/toolbar.component';
import { SpacerDirective } from '../../../shared/directives/spacer.directive';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { AuthService } from '../../../shared/services/auth.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { TermsService } from '../services/terms.service';
import { TermsScope } from '../models/terms-scope.model';
import { TermsDocument } from '../models/terms-document.model';
import { TermsDialogComponent, TermsDialogData, TermsDialogResult } from '../components/terms-dialog/terms-dialog.component';

/**
 * S3 — admin terms & conditions catalog. Lists Company-scope terms by default
 * with a scope filter to browse Customer / Part terms too. Company-scope
 * create / edit / delete is Admin-only (enforced server-side and gated here);
 * Customer / Part scope is available to the broader admin roles.
 */
@Component({
  selector: 'app-terms-admin',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, TranslatePipe,
    PageLayoutComponent, ToolbarComponent, SpacerDirective, SelectComponent,
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
  ],
  templateUrl: './terms-admin.component.html',
  styleUrl: './terms-admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsAdminComponent {
  private readonly service = inject(TermsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isAdmin = computed(() => this.auth.hasRole('Admin'));

  protected readonly terms = signal<TermsDocument[]>([]);
  protected readonly loading = signal(true);

  protected readonly scopeFilter = new FormControl<TermsScope>('Company', { nonNullable: true });
  protected readonly scopeFilterOptions: SelectOption[] = [
    { value: 'Company', label: this.translate.instant('terms.scope.company') },
    { value: 'Customer', label: this.translate.instant('terms.scope.customer') },
    { value: 'Part', label: this.translate.instant('terms.scope.part') },
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'title', header: this.translate.instant('terms.columns.title'), sortable: true },
    { field: 'target', header: this.translate.instant('terms.columns.target'), sortable: false },
    { field: 'version', header: this.translate.instant('terms.columns.version'), sortable: true, type: 'number', align: 'right', width: '80px' },
    { field: 'effectiveFrom', header: this.translate.instant('terms.columns.effectiveFrom'), sortable: true, type: 'date', width: '120px' },
    { field: 'effectiveTo', header: this.translate.instant('terms.columns.effectiveTo'), sortable: true, type: 'date', width: '120px' },
    { field: 'isActive', header: this.translate.instant('common.active'), sortable: true, width: '90px', align: 'center' },
    { field: 'sortOrder', header: this.translate.instant('terms.columns.sortOrder'), sortable: true, type: 'number', align: 'right', width: '90px' },
    { field: 'actions', header: '', width: '100px', align: 'right' },
  ];

  constructor() {
    this.load();
    this.scopeFilter.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  /** A row is mutable when it isn't Company-scope, or the user is an Admin. */
  protected canMutate(row: TermsDocument): boolean {
    return row.scope !== 'Company' || this.isAdmin();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.list({ scope: this.scopeFilter.value })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => { this.terms.set(rows); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
  }

  protected openNew(): void {
    const allowedScopes: TermsScope[] = this.isAdmin()
      ? ['Company', 'Customer', 'Part']
      : ['Customer', 'Part'];
    this.dialog.open<TermsDialogComponent, TermsDialogData, TermsDialogResult | undefined>(
      TermsDialogComponent,
      { width: '640px', data: { allowedScopes } },
    ).afterClosed().subscribe(saved => { if (saved) this.load(); });
  }

  protected openEdit(row: TermsDocument): void {
    this.dialog.open<TermsDialogComponent, TermsDialogData, TermsDialogResult | undefined>(
      TermsDialogComponent,
      { width: '640px', data: { terms: row } },
    ).afterClosed().subscribe(saved => { if (saved) this.load(); });
  }

  protected confirmDelete(row: TermsDocument): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('terms.delete.title'),
        message: this.translate.instant('terms.delete.message', { title: row.title }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.delete(row.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('terms.deleted'));
          this.load();
        },
      });
    });
  }
}
