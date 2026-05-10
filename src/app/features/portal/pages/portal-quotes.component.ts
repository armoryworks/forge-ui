import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { PortalQuote } from '../models/portal.model';
import { PortalService } from '../services/portal.service';

@Component({
  selector: 'app-portal-quotes',
  standalone: true,
  imports: [DatePipe, DecimalPipe, TranslatePipe, LoadingBlockDirective, EmptyStateComponent],
  templateUrl: './portal-quotes.component.html',
  styleUrl: './portal-list.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalQuotesComponent implements OnInit {
  private readonly portal = inject(PortalService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly quotes = signal<PortalQuote[]>([]);
  protected readonly loading = signal(true);
  protected readonly responding = signal<Set<number>>(new Set());

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.portal.getQuotes().subscribe({
      next: (data) => { this.quotes.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected respond(quote: PortalQuote, accepted: boolean): void {
    const next = new Set(this.responding());
    next.add(quote.id);
    this.responding.set(next);

    this.portal.respondToQuote(quote.id, accepted).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant(
          accepted ? 'portal.quotes.acceptedToast' : 'portal.quotes.declinedToast',
        ));
        this.load();
      },
      error: () => {
        const after = new Set(this.responding());
        after.delete(quote.id);
        this.responding.set(after);
      },
    });
  }

  protected isResponding(id: number): boolean {
    return this.responding().has(id);
  }

  protected statusClass(status: string): string {
    switch (status) {
      case 'Draft': return 'chip chip--muted';
      case 'Sent': return 'chip chip--info';
      case 'Accepted': case 'ConvertedToOrder': return 'chip chip--success';
      case 'Declined': case 'Expired': return 'chip chip--error';
      case 'ConvertedToQuote': return 'chip chip--warning';
      default: return 'chip';
    }
  }
}
