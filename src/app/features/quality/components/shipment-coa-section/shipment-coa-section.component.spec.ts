import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ShipmentCoaSectionComponent } from './shipment-coa-section.component';
import { CoaService } from '../../services/coa.service';
import { CertificateOfAnalysis } from '../../models/certificate-of-analysis.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { EntityPreviewService } from '../../../../shared/services/entity-preview.service';
import { FileDownloadService } from '../../../../shared/services/file-download.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

const CERT: CertificateOfAnalysis = {
  id: 8, certificateNumber: 'COA-000008', lotRecordId: 5, lotNumber: 'L-5', partId: 1, partNumber: 'P-1', partRevision: null,
  customerId: 2, customerName: 'Lab Supply', shipmentId: 6, shipmentNumber: 'SH-6', status: 'Issued', conforms: true,
  language: 'en', generatedAt: '2026-10-01T00:00:00Z', generatedByName: null, fileAttachmentId: 9, notes: null, results: [],
};

describe('ShipmentCoaSectionComponent', () => {
  let roles: string[];
  let attachToShipment: ReturnType<typeof vi.fn>;
  let snackbar: { success: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; errorFrom: ReturnType<typeof vi.fn> };

  function render(shipped = true) {
    attachToShipment = vi.fn(() => of({
      attached: [CERT],
      warnings: [{ lotId: 7, lotNumber: 'L-7', partNumber: 'P-1', code: 'coa-nonconforming', failedCharacteristics: ['Hardness'] }],
    }));
    snackbar = { success: vi.fn(), warn: vi.fn(), info: vi.fn(), errorFrom: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ShipmentCoaSectionComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: CoaService, useValue: { list: vi.fn(() => of([])), attachToShipment, pdfUrl: () => '' } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
        { provide: CapabilityService, useValue: { isEnabled: () => true } },
        { provide: EntityPreviewService, useValue: { getPreview: vi.fn(() => of(null)) } },
        { provide: FileDownloadService, useValue: { open: vi.fn() } },
        { provide: SnackbarService, useValue: snackbar },
      ],
    });
    const fixture = TestBed.createComponent(ShipmentCoaSectionComponent);
    fixture.componentRef.setInput('shipmentId', 6);
    fixture.componentRef.setInput('shipped', shipped);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    roles = ['OfficeManager'];
  });

  it('attaches certificates and shows the lots that could not be certified', () => {
    const { fixture, el } = render();

    (el.querySelector('[data-testid="shipment-coa-attach-btn"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(attachToShipment).toHaveBeenCalledWith(6);
    expect(el.querySelector('[data-testid="coa-row-8"]')?.textContent).toContain('COA-000008');
    expect(el.querySelector('[data-testid="shipment-coa-warning-7"]')?.textContent).toContain('coa.warningNonConforming');
    expect(snackbar.warn).toHaveBeenCalled();
  });

  it('explains that pending shipments are certified when they ship', () => {
    expect(render(false).el.querySelector('[data-testid="shipment-coa-pending-hint"]')).not.toBeNull();
  });

  it('is hidden from roles outside shipping', () => {
    roles = ['Engineer'];
    expect(render().el.querySelector('[data-testid="shipment-coa-section"]')).toBeNull();
  });
});
