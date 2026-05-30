import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';

import { ConnectionsRegistryService } from '../../services/connections-registry.service';
import { IntegrationKind, IntegrationRecord } from '../../models/integration-record.model';

interface KindDescriptor {
  label: string;
  icon: string;
}

/**
 * Connections registry panel — federated read-only view of every credential
 * / connection an install holds (BI keys, system keys, EDI partners,
 * QuickBooks OAuth, communications sync, cloud-storage links).
 *
 * The list is synthesized server-side by IConnectionsRegistry. Each row
 * carries a `manageRoute` deep-link to its native admin surface; this panel
 * never mutates — clicking Manage on a row navigates to the native page.
 */
@Component({
  selector: 'app-connections-panel',
  standalone: true,
  imports: [
    DatePipe,
    TranslatePipe,
    DataTableComponent,
    ColumnCellDirective,
    LoadingBlockDirective,
  ],
  templateUrl: './connections-panel.component.html',
  styleUrl: './connections-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionsPanelComponent implements OnInit {
  private readonly service = inject(ConnectionsRegistryService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  protected readonly isLoading = signal(false);
  protected readonly rows = signal<IntegrationRecord[]>([]);
  protected readonly count = computed(() => this.rows().length);

  protected readonly columns: ColumnDef[] = [
    { field: 'kind', header: this.translate.instant('adminPanels.connections.cols.kind'), sortable: true, width: '180px' },
    { field: 'name', header: this.translate.instant('adminPanels.connections.cols.name'), sortable: true },
    { field: 'ownerEmail', header: this.translate.instant('adminPanels.connections.cols.owner'), sortable: true },
    { field: 'status', header: this.translate.instant('adminPanels.connections.cols.status'), sortable: true, width: '120px' },
    { field: 'lastUsedAt', header: this.translate.instant('adminPanels.connections.cols.lastUsed'), sortable: true, type: 'date', width: '160px' },
    { field: 'createdAt', header: this.translate.instant('adminPanels.connections.cols.created'), sortable: true, type: 'date', width: '140px' },
    { field: 'actions', header: '', width: '120px', align: 'right' },
  ];

  /**
   * One-source-of-truth map from server enum to display label + icon. Used
   * by the Kind cell template via <see cref="describeKind"/>. Adding a new
   * IntegrationKind on the server means one line here.
   */
  protected readonly kindDescriptors: Record<IntegrationKind, KindDescriptor> = {
    BiApiKey: { label: this.translate.instant('adminPanels.connections.kinds.BiApiKey'), icon: 'vpn_key' },
    SystemApiKey: { label: this.translate.instant('adminPanels.connections.kinds.SystemApiKey'), icon: 'key' },
    EdiTradingPartner: { label: this.translate.instant('adminPanels.connections.kinds.EdiTradingPartner'), icon: 'sync_alt' },
    QuickBooksOAuth: { label: this.translate.instant('adminPanels.connections.kinds.QuickBooksOAuth'), icon: 'account_balance' },
    CommunicationSync: { label: this.translate.instant('adminPanels.connections.kinds.CommunicationSync'), icon: 'email' },
    CloudStorageLink: { label: this.translate.instant('adminPanels.connections.kinds.CloudStorageLink'), icon: 'cloud' },
  };

  /**
   * Typed lookup wrapper for the template. The data-table row type lands
   * as `unknown` in the templated cell binding, so $any(row).kind isn't
   * assignable as a Record<IntegrationKind, …> key under strict template
   * type-checking. This helper takes the IntegrationRecord projection and
   * routes through the typed map, falling back to a generic descriptor
   * for any kind the client hasn't been updated for yet.
   */
  protected describeKind(row: IntegrationRecord): KindDescriptor {
    return this.kindDescriptors[row.kind] ?? { label: row.kind, icon: 'extension' };
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.service.list().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  /**
   * Status → chip modifier. Each native source has its own status vocabulary
   * (Active / Revoked / Expired / Connected / Disconnected / Linked / Inactive
   * — see the server's ConnectionsRegistry). We map them onto the standard
   * chip palette so the UI is consistent across kinds.
   */
  protected statusChipClass(status: string): string {
    switch (status) {
      case 'Active':
      case 'Connected':
      case 'Linked':
        return 'chip--success';
      case 'Expired':
        return 'chip--warning';
      case 'Revoked':
      case 'Disconnected':
      case 'Inactive':
        return 'chip--neutral';
      default:
        return 'chip--neutral';
    }
  }

  protected manage(row: IntegrationRecord): void {
    this.router.navigateByUrl(row.manageRoute);
  }
}
