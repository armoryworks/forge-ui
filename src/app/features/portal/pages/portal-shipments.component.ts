import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { portalStatusChip, portalStatusLabelKey } from '../portal-status';
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
  protected readonly loadError = signal(false);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.portal.getShipments().subscribe({
      next: (data) => { this.shipments.set(data); this.loading.set(false); },
      error: () => { this.loading.set(false); this.loadError.set(true); },
    });
  }

  protected statusChip(status: string): string {
    return portalStatusChip('shipment', status);
  }

  protected statusLabelKey(status: string): string {
    return portalStatusLabelKey('shipment', status);
  }
}
