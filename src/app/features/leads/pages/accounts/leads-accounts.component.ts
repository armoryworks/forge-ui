import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AccountsService } from '../../services/accounts.service';
import { Account, CreateAccountRequest, UpdateAccountRequest } from '../../models/account.model';
import { AccountDialogComponent, AccountDialogData } from '../../components/account-dialog/account-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { ToolbarComponent } from '../../../../shared/components/toolbar/toolbar.component';
import { SpacerDirective } from '../../../../shared/directives/spacer.directive';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

/**
 * Phase 1r / Batch 12 — accounts list page.
 *
 * Accounts are multi-contact B2B parent groupings — useful when one
 * prospect company has several reps (engineering / procurement /
 * exec sponsor) and a single Lead row would force the team to choose
 * which contact to surface. Each lead optionally points at an Account
 * via Lead.accountId; conversion rolls the account's contacts forward
 * as non-primary Contact rows on the resulting Customer.
 *
 * This page lists every account with a contact-count + lead-count.
 * The full multi-contact detail view + per-account leads/customers
 * timeline is a follow-on once usage patterns settle.
 */
@Component({
  selector: 'app-leads-accounts',
  standalone: true,
  imports: [
    DatePipe, TranslatePipe,
    PageLayoutComponent, ToolbarComponent, SpacerDirective,
    DataTableComponent, ColumnCellDirective,
    LoadingBlockDirective,
  ],
  templateUrl: './leads-accounts.component.html',
  styleUrl: './leads-accounts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadsAccountsComponent {
  private readonly service = inject(AccountsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly accounts = signal<Account[]>([]);
  protected readonly loading = signal(true);

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: this.translate.instant('leads.accounts.colName'), sortable: true },
    { field: 'industry', header: this.translate.instant('leads.accounts.colIndustry'), sortable: true, width: '160px' },
    { field: 'sizeBracket', header: this.translate.instant('leads.accounts.colSize'), sortable: true, width: '120px' },
    { field: 'city', header: this.translate.instant('leads.accounts.colCity'), sortable: true, width: '140px' },
    { field: 'state', header: this.translate.instant('leads.accounts.colState'), sortable: true, width: '80px' },
    { field: 'contactCount', header: this.translate.instant('leads.accounts.colContacts'), sortable: true, type: 'number', align: 'right', width: '90px' },
    { field: 'leadCount', header: this.translate.instant('leads.accounts.colLeads'), sortable: true, type: 'number', align: 'right', width: '80px' },
    { field: 'createdAt', header: this.translate.instant('leads.accounts.colCreated'), sortable: true, type: 'date', width: '110px' },
    { field: 'actions', header: '', width: '90px', align: 'right' },
  ];

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => { this.accounts.set(rows); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openNew(): void {
    this.dialog.open<AccountDialogComponent, AccountDialogData, CreateAccountRequest | undefined>(
      AccountDialogComponent, { width: '640px', data: {} },
    ).afterClosed().subscribe(payload => {
      if (!payload) return;
      this.service.create(payload).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('leads.accounts.created'));
          this.load();
        },
      });
    });
  }

  protected openEdit(account: Account): void {
    this.dialog.open<AccountDialogComponent, AccountDialogData, UpdateAccountRequest | undefined>(
      AccountDialogComponent, { width: '640px', data: { account } },
    ).afterClosed().subscribe(payload => {
      if (!payload) return;
      this.service.update(account.id, payload as UpdateAccountRequest).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('leads.accounts.updated'));
          this.load();
        },
      });
    });
  }

  /**
   * Confirm + soft-delete an account. The server refuses deletion when
   * any lead references the account; the snackbar surfaces that case via
   * the global HTTP-error interceptor.
   */
  protected confirmDelete(account: Account, ev?: Event): void {
    ev?.stopPropagation();
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('leads.accounts.deleteTitle'),
        message: account.leadCount > 0
          ? this.translate.instant('leads.accounts.deleteBlockedMessage', { name: account.name, count: account.leadCount })
          : this.translate.instant('leads.accounts.deleteMessage', { name: account.name }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.delete(account.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('leads.accounts.deleted'));
          this.load();
        },
      });
    });
  }
}
