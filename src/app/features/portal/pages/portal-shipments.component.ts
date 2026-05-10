import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PortalShipment } from '../models/portal.model';
import { PortalService } from '../services/portal.service';

@Component({
  selector: 'app-portal-shipments',
  standalone: true,
  imports: [DatePipe, TranslatePipe, LoadingBlockDirective, EmptyStateComponent],
  templateUrl: './portal-shipments.component.html',
  styleUrl: './portal-list.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalShipmentsComponent implements OnInit {
  private readonly portal = inject(PortalService);

  protected readonly shipments = signal<PortalShipment[]>([]);
  protected readonly loading = signal(true);

  ngOnInit(): void {
    this.portal.getShipments().subscribe({
      next: (data) => { this.shipments.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected statusClass(status: string): string {
    switch (status) {
      case 'Pending': return 'chip chip--muted';
      case 'Shipped': case 'InTransit': return 'chip chip--info';
      case 'Delivered': return 'chip chip--success';
      case 'Lost': case 'Damaged': return 'chip chip--error';
      default: return 'chip';
    }
  }
}
