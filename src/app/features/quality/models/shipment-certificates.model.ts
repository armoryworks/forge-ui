import { CertificateOfAnalysis } from './certificate-of-analysis.model';
import { CoaAttachWarning } from './coa-attach-warning.model';

export interface ShipmentCertificates {
  attached: CertificateOfAnalysis[];
  warnings: CoaAttachWarning[];
}
