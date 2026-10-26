import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ShipmentService } from '../../services/shipment.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { FileDownloadService } from '../../../../shared/services/file-download.service';

/** Packing slip and bill of lading for a shipment, each opened as a PDF in a new tab (document generation on). */
@Component({
  selector: 'app-shipment-documents-actions',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './shipment-documents-actions.component.html',
  styleUrl: './shipment-documents-actions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShipmentDocumentsActionsComponent {
  private readonly shipmentService = inject(ShipmentService);
  private readonly files = inject(FileDownloadService);
  private readonly capabilities = inject(CapabilityService);

  readonly shipmentId = input.required<number>();
  readonly shipmentNumber = input<string>('');

  protected readonly visible = computed(() => this.capabilities.isEnabled('CAP-CROSS-DOCS'));

  protected openPackingSlip(): void {
    this.files.openOrDownload(this.shipmentService.packingSlipUrl(this.shipmentId()), `packing-slip-${this.label()}.pdf`, 'application/pdf');
  }

  protected openBillOfLading(): void {
    this.files.openOrDownload(this.shipmentService.billOfLadingUrl(this.shipmentId()), `bill-of-lading-${this.label()}.pdf`, 'application/pdf');
  }

  private label(): string {
    return this.shipmentNumber() || String(this.shipmentId());
  }
}
