import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { TermsService } from '../../services/terms.service';
import { TermsScope } from '../../models/terms-scope.model';
import { TermsDocument } from '../../models/terms-document.model';
import { TermsDialogComponent, TermsDialogData, TermsDialogResult } from '../terms-dialog/terms-dialog.component';

/**
 * S3 — compact terms & conditions section for a single customer or part.
 *
 * Reused on both the customer detail page (`scope="Customer"`) and the part
 * detail panel (`scope="Part"`). Self-loads the scoped documents and offers
 * add / edit / delete via the shared {@link TermsDialogComponent} + a
 * ConfirmDialog for delete. Scope + target are locked in the dialog.
 */
@Component({
  selector: 'app-terms-section',
  standalone: true,
  imports: [TranslatePipe, DatePipe, LoadingBlockDirective],
  templateUrl: './terms-section.component.html',
  styleUrl: './terms-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsSectionComponent {
  private readonly termsService = inject(TermsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly scope = input.required<TermsScope>();
  readonly customerId = input<number | null>(null);
  readonly partId = input<number | null>(null);
  /** Human label for the target — shown read-only in the add/edit dialog. */
  readonly targetName = input<string>('');

  protected readonly terms = signal<TermsDocument[]>([]);
  protected readonly loading = signal(false);

  protected readonly titleKey = computed(() =>
    this.scope() === 'Part' ? 'terms.section.partTitle' : 'terms.section.customerTitle');

  constructor() {
    // Re-load whenever the scope or target id changes (mirrors the customer
    // documents cluster's effect-driven load).
    effect(() => this.load(this.scope(), this.customerId(), this.partId()));
  }

  protected openAdd(): void {
    this.dialog.open<TermsDialogComponent, TermsDialogData, TermsDialogResult | undefined>(
      TermsDialogComponent,
      {
        width: '640px',
        data: {
          lockedScope: this.scope(),
          customerId: this.customerId() ?? undefined,
          partId: this.partId() ?? undefined,
          targetLabel: this.targetName() || undefined,
        },
      },
    ).afterClosed().subscribe(saved => { if (saved) this.reload(); });
  }

  protected openEdit(row: TermsDocument): void {
    this.dialog.open<TermsDialogComponent, TermsDialogData, TermsDialogResult | undefined>(
      TermsDialogComponent,
      { width: '640px', data: { terms: row, targetLabel: this.targetName() || undefined } },
    ).afterClosed().subscribe(saved => { if (saved) this.reload(); });
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
      this.termsService.delete(row.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('terms.deleted'));
          this.reload();
        },
      });
    });
  }

  private reload(): void {
    this.load(this.scope(), this.customerId(), this.partId());
  }

  private load(scope: TermsScope, customerId: number | null, partId: number | null): void {
    const target = scope === 'Part' ? partId : customerId;
    if (target == null) {
      this.terms.set([]);
      return;
    }
    this.loading.set(true);
    this.termsService.list({
      scope,
      customerId: scope === 'Customer' ? customerId ?? undefined : undefined,
      partId: scope === 'Part' ? partId ?? undefined : undefined,
    }).subscribe({
      next: (rows) => { this.terms.set(rows); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
