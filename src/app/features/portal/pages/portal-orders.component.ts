import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PortalSalesOrder } from '../models/portal.model';
import { PortalService } from '../services/portal.service';

@Component({
  selector: 'app-portal-orders',
  standalone: true,
  imports: [DatePipe, DecimalPipe, TranslatePipe, LoadingBlockDirective, EmptyStateComponent],
  templateUrl: './portal-orders.component.html',
  styleUrl: './portal-list.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalOrdersComponent implements OnInit {
  private readonly portal = inject(PortalService);

  protected readonly orders = signal<PortalSalesOrder[]>([]);
  protected readonly loading = signal(true);

  ngOnInit(): void {
    this.portal.getSalesOrders().subscribe({
      next: (data) => { this.orders.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected statusClass(status: string): string {
    switch (status) {
      case 'Draft': return 'chip chip--muted';
      case 'Confirmed': case 'InProduction': return 'chip chip--info';
      case 'Shipped': case 'PartiallyShipped': return 'chip chip--warning';
      case 'Completed': return 'chip chip--success';
      case 'Cancelled': return 'chip chip--error';
      default: return 'chip';
    }
  }
}
