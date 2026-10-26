import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ShipmentService } from '../../services/shipment.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { FileDownloadService } from '../../../../shared/services/file-download.service';
import { ShipmentDocumentsActionsComponent } from './shipment-documents-actions.component';

interface Internals {
  visible: Signal<boolean>;
  openPackingSlip(): void;
  openBillOfLading(): void;
}

describe('ShipmentDocumentsActionsComponent', () => {
  const openOrDownload = vi.fn();
  let docsOn = true;

  function create(): Internals {
    const component = TestBed.runInInjectionContext(() => new ShipmentDocumentsActionsComponent());
    mockSignalInputs(component, { shipmentId: 7, shipmentNumber: 'SH-7' });
    return component as unknown as Internals;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    openOrDownload.mockClear();
    docsOn = true;
    TestBed.configureTestingModule({
      providers: [
        { provide: ShipmentService, useValue: { packingSlipUrl: (id: number) => `/s/${id}/packing-slip`, billOfLadingUrl: (id: number) => `/s/${id}/bill-of-lading` } },
        { provide: FileDownloadService, useValue: { openOrDownload } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => code === 'CAP-CROSS-DOCS' && docsOn } },
      ],
    });
  });

  it('opens the packing slip as a PDF in a new tab', () => {
    create().openPackingSlip();
    expect(openOrDownload).toHaveBeenCalledWith('/s/7/packing-slip', 'packing-slip-SH-7.pdf', 'application/pdf');
  });

  it('opens the bill of lading as a PDF in a new tab', () => {
    create().openBillOfLading();
    expect(openOrDownload).toHaveBeenCalledWith('/s/7/bill-of-lading', 'bill-of-lading-SH-7.pdf', 'application/pdf');
  });

  it('hides both buttons when document generation is off', () => {
    expect(create().visible()).toBe(true);
    docsOn = false;
    expect(create().visible()).toBe(false);
  });
});
