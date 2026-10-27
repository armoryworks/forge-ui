import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { CoaListComponent } from './coa-list.component';
import { CoaService } from '../../services/coa.service';
import { CertificateOfAnalysis } from '../../models/certificate-of-analysis.model';
import { FileDownloadService } from '../../../../shared/services/file-download.service';

const CERT: CertificateOfAnalysis = {
  id: 3, certificateNumber: 'COA-000003', lotRecordId: 5, lotNumber: 'L-5', partId: 1, partNumber: 'P-1', partRevision: null,
  customerId: null, customerName: null, shipmentId: null, shipmentNumber: null, status: 'Issued', conforms: true,
  language: 'en', generatedAt: '2026-10-01T00:00:00Z', generatedByName: null, fileAttachmentId: 9, notes: null, results: [],
};

describe('CoaListComponent', () => {
  it('downloads the certificate PDF in the language picked and offers void only when allowed', () => {
    const open = vi.fn();
    TestBed.configureTestingModule({
      imports: [CoaListComponent, TranslateModule.forRoot()],
      providers: [
        { provide: CoaService, useValue: { pdfUrl: (id: number, lang: string) => `/coa/${id}/pdf?language=${lang}` } },
        { provide: FileDownloadService, useValue: { open } },
      ],
    });
    const fixture = TestBed.createComponent(CoaListComponent);
    fixture.componentRef.setInput('certificates', [CERT, { ...CERT, id: 4, status: 'Voided' }]);
    fixture.componentRef.setInput('canVoid', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    (el.querySelector('[data-testid="coa-pdf-es-3"]') as HTMLButtonElement).click();

    expect(open).toHaveBeenCalledWith('/coa/3/pdf?language=es', 'COA-000003-es.pdf');
    expect(el.querySelector('[data-testid="coa-void-3"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="coa-void-4"]')).toBeNull();
  });
});
