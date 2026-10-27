import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { CoaService } from '../../services/coa.service';
import { CertificateOfAnalysis } from '../../models/certificate-of-analysis.model';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { FileDownloadService } from '../../../../shared/services/file-download.service';

@Component({
  selector: 'app-coa-list',
  standalone: true,
  imports: [DatePipe, TranslatePipe, EntityLinkComponent],
  templateUrl: './coa-list.component.html',
  styleUrl: './coa-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoaListComponent {
  private readonly coaService = inject(CoaService);
  private readonly fileDownload = inject(FileDownloadService);

  readonly certificates = input.required<CertificateOfAnalysis[]>();
  readonly canVoid = input(false);
  readonly showLot = input(false);
  readonly voidRequested = output<CertificateOfAnalysis>();

  protected download(certificate: CertificateOfAnalysis, language: 'en' | 'es'): void {
    this.fileDownload.open(
      this.coaService.pdfUrl(certificate.id, language),
      `${certificate.certificateNumber}-${language}.pdf`);
  }
}
