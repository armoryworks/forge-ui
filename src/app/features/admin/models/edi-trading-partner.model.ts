import { EdiFormat } from './edi-format.model';
import { EdiTransportMethod } from './edi-transport-method.model';

export interface EdiTradingPartner {
  id: number;
  name: string;
  customerId: number | null;
  customerName: string | null;
  vendorId: number | null;
  vendorName: string | null;
  qualifierId: string;
  qualifierValue: string;
  defaultFormat: EdiFormat;
  transportMethod: EdiTransportMethod;
  autoProcess: boolean;
  requireAcknowledgment: boolean;
  isActive: boolean;
  notes: string | null;
  transactionCount: number;
  lastTransactionAt: string | null;
  errorCount: number;
  /** Sanitized SFTP transport display (password never leaves the server). */
  transportSftp?: EdiSftpTransportInfo | null;
}

// ⚡ EDI BOUNDARY — typed SFTP transport fields (the admin dialog edits these, never JSON).
export interface EdiSftpTransportInfo {
  host: string;
  port: number;
  username: string;
  hasPassword: boolean;
  outboundDir: string;
  inboundDir: string;
}

/** Save payload for partner create/update — typed transport, password write-only. */
export interface EdiTradingPartnerSaveRequest {
  name: string;
  qualifierId: string;
  qualifierValue: string;
  defaultFormat: EdiFormat;
  transportMethod: EdiTransportMethod;
  autoProcess: boolean;
  requireAcknowledgment: boolean;
  notes: string | null;
  transportSftp: EdiSftpTransportSaveRequest | null;
}

/** Write-only SFTP fields (blank password on update keeps the stored one). */
export interface EdiSftpTransportSaveRequest {
  host: string;
  port: number;
  username: string;
  password: string | null;
  outboundDir: string;
  inboundDir: string;
}
