import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { CurrencyDisplayComponent } from '../../../shared/components/currency-display/currency-display.component';
import { portalStatusChip, portalStatusLabelKey } from '../portal-status';
import { PortalInvoice } from '../models/portal.model';
import { PortalService } from '../services/portal.service';
import { DateOnlyPipe } from '../../../shared/pipes/date-only.pipe';

@Component({
  selector: 'app-portal-invoices',
  standalone: true,
  imports: [DateOnlyPipe, TranslatePipe, LoadingBlockDirective, EmptyStateComponent, CurrencyDisplayComponent],
  templateUrl: './portal-invoices.component.html',
  styleUrl: './portal-list.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalInvoicesComponent implements OnInit {
  private readonly portal = inject(PortalService);

  protected readonly invoices = signal<PortalInvoice[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly externalAccounting = signal(false);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.portal.getInvoices().subscribe({
      next: (data) => {
        this.invoices.set(data.items);
        this.totalCount.set(data.totalCount);
        this.externalAccounting.set(data.externalAccounting);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.loadError.set(true); },
    });
  }

  protected statusChip(status: string): string {
    return portalStatusChip('invoice', status);
  }

  protected statusLabelKey(status: string): string {
    return portalStatusLabelKey('invoice', status);
  }
}
