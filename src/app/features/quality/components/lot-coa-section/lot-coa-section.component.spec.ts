import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { LotCoaSectionComponent } from './lot-coa-section.component';
import { CoaService } from '../../services/coa.service';
import { CertificateOfAnalysis } from '../../models/certificate-of-analysis.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { FileDownloadService } from '../../../../shared/services/file-download.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

const CERT: CertificateOfAnalysis = {
  id: 3, certificateNumber: 'COA-000003', lotRecordId: 5, lotNumber: 'L-5', partId: 1, partNumber: 'P-1', partRevision: 'B',
  customerId: null, customerName: null, shipmentId: null, shipmentNumber: null, status: 'Issued', conforms: false,
  language: 'en', generatedAt: '2026-10-01T00:00:00Z', generatedByName: null, fileAttachmentId: 9, notes: null, results: [],
};

describe('LotCoaSectionComponent', () => {
  let roles: string[];
  let enabled: boolean;
  let list: ReturnType<typeof vi.fn>;
  let dialogOpen: ReturnType<typeof vi.fn>;

  function render() {
    list = vi.fn(() => of([CERT]));
    dialogOpen = vi.fn(() => ({ afterClosed: () => of({ ...CERT, id: 4, certificateNumber: 'COA-000004', conforms: true }) }));
    TestBed.configureTestingModule({
      imports: [LotCoaSectionComponent, TranslateModule.forRoot()],
      providers: [
        { provide: CoaService, useValue: { list, pdfUrl: (id: number, lang: string) => `/coa/${id}/${lang}` } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
        { provide: CapabilityService, useValue: { isEnabled: () => enabled } },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: FileDownloadService, useValue: { open: vi.fn() } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(LotCoaSectionComponent);
    fixture.componentRef.setInput('lotId', 5);
    fixture.componentRef.setInput('lotNumber', 'L-5');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    roles = ['Engineer'];
    enabled = true;
  });

  it('lists the lot certificates and marks one that does not conform', () => {
    const { el } = render();

    expect(list).toHaveBeenCalledWith({ lotId: 5 });
    expect(el.querySelector('[data-testid="coa-row-3"]')?.textContent).toContain('COA-000003');
    expect(el.querySelector('[data-testid="coa-nonconforming-3"]')).not.toBeNull();
  });

  it('lets quality generate a certificate and shows it first', () => {
    const { fixture, el } = render();

    (el.querySelector('[data-testid="lot-coa-generate-btn"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(dialogOpen).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ data: { lotId: 5, lotNumber: 'L-5' } }));
    expect(el.querySelectorAll('[data-testid^="coa-row-"]')[0].textContent).toContain('COA-000004');
  });

  it('shows certificates to shipping without the generate button', () => {
    roles = ['OfficeManager'];
    const { el } = render();

    expect(el.querySelector('[data-testid="lot-coa-section"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="lot-coa-generate-btn"]')).toBeNull();
  });

  it('is hidden when the capability is off or the role cannot read certificates', () => {
    enabled = false;
    expect(render().el.querySelector('[data-testid="lot-coa-section"]')).toBeNull();
    expect(list).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    enabled = true;
    roles = ['ProductionWorker'];
    expect(render().el.querySelector('[data-testid="lot-coa-section"]')).toBeNull();
  });
});
