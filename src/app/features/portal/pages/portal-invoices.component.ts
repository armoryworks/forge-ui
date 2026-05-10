import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PortalInvoice } from '../models/portal.model';
import { PortalService } from '../services/portal.service';

@Component({
  selector: 'app-portal-invoices',
  standalone: true,
  imports: [DatePipe, DecimalPipe, TranslatePipe, LoadingBlockDirective, EmptyStateComponent],
  templateUrl: './portal-invoices.component.html',
  styleUrl: './portal-list.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalInvoicesComponent implements OnInit {
  private readonly portal = inject(PortalService);

  protected readonly invoices = signal<PortalInvoice[]>([]);
  protected readonly loading = signal(true);
  /** True when the install has an external accounting provider connected,
   *  in which case the API returns an empty list (we suppress the
   *  "no invoices yet" empty state and show a clearer message). */
  protected readonly accountingIntegrated = signal(false);

  ngOnInit(): void {
    this.portal.getDashboard().subscribe(summary => {
      // Heuristic: in integrated mode the dashboard's open-invoice count
      // is hard-zero (the list endpoint short-circuits the same way).
      // We surface a different empty-state message in that case.
      if (summary.openInvoiceCount === 0) {
        // Not conclusive yet — could just be no open invoices in standalone
        // mode. Defer to the list response.
      }
    });

    this.portal.getInvoices().subscribe({
      next: (data) => { this.invoices.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected statusClass(status: string): string {
    switch (status) {
      case 'Draft': return 'chip chip--muted';
      case 'Sent': return 'chip chip--info';
      case 'PartiallyPaid': return 'chip chip--warning';
      case 'Paid': return 'chip chip--success';
      case 'Overdue': return 'chip chip--error';
      case 'Void': return 'chip chip--muted';
      default: return 'chip';
    }
  }
}
