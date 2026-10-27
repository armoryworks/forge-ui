export type CoaAttachWarningCode = 'coa-nonconforming' | 'coa-no-results';

export interface CoaAttachWarning {
  lotId: number;
  lotNumber: string;
  partNumber: string;
  code: CoaAttachWarningCode;
  failedCharacteristics: string[];
}
