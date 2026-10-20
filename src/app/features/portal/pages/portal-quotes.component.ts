import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { CurrencyDisplayComponent } from '../../../shared/components/currency-display/currency-display.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { wasHttpErrorShown } from '../../../shared/utils/shown-http-errors';
import { portalQuoteTypeLabelKey, portalStatusChip, portalStatusLabelKey } from '../portal-status';
import { PortalQuote } from '../models/portal.model';
import { PortalService } from '../services/portal.service';

@Component({
  selector: 'app-portal-quotes',
  standalone: true,
  imports: [DatePipe, TranslatePipe, LoadingBlockDirective, EmptyStateComponent, CurrencyDisplayComponent],
  templateUrl: './portal-quotes.component.html',
  styleUrl: './portal-list.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalQuotesComponent implements OnInit {
  private readonly portal = inject(PortalService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);

  protected readonly quotes = signal<PortalQuote[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly responding = signal<Set<number>>(new Set());

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.portal.getQuotes().subscribe({
      next: (data) => { this.quotes.set(data.items); this.totalCount.set(data.totalCount); this.loading.set(false); },
      error: () => { this.loading.set(false); this.loadError.set(true); },
    });
  }

  protected respond(quote: PortalQuote, accepted: boolean): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant(accepted ? 'portal.quotes.acceptTitle' : 'portal.quotes.declineTitle'),
        message: this.translate.instant(
          accepted ? 'portal.quotes.acceptMessage' : 'portal.quotes.declineMessage',
          { number: quote.quoteNumber },
        ),
        confirmLabel: this.translate.instant(accepted ? 'portal.quotes.accept' : 'portal.quotes.decline'),
        severity: accepted ? 'info' : 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) this.submitResponse(quote, accepted);
    });
  }

  private submitResponse(quote: PortalQuote, accepted: boolean): void {
    const next = new Set(this.responding());
    next.add(quote.id);
    this.responding.set(next);

    this.portal.respondToQuote(quote.id, accepted).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant(
          accepted ? 'portal.quotes.acceptedToast' : 'portal.quotes.declinedToast',
        ));
        this.clearResponding(quote.id);
        this.load();
      },
      error: (err: unknown) => {
        this.clearResponding(quote.id);
        if (err instanceof HttpErrorResponse && err.status === 401) return;
        if (!wasHttpErrorShown(err)) {
          this.snackbar.error(this.translate.instant('portal.quotes.respondFailed', { number: quote.quoteNumber }));
        }
        this.load();
      },
    });
  }

  private clearResponding(id: number): void {
    const after = new Set(this.responding());
    after.delete(id);
    this.responding.set(after);
  }

  protected isResponding(id: number): boolean {
    return this.responding().has(id);
  }

  protected statusChip(status: string): string {
    return portalStatusChip('quote', status);
  }

  protected statusLabelKey(status: string): string {
    return portalStatusLabelKey('quote', status);
  }

  protected quoteTypeLabelKey(quoteType: string): string {
    return portalQuoteTypeLabelKey(quoteType);
  }
}
