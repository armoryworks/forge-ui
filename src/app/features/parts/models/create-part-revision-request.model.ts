export interface CreatePartRevisionRequest {
  revision: string;
  changeDescription?: string;
  changeReason?: string;
  effectiveDate: string;
}
