import { TermsScope } from './terms-scope.model';

/** Payload for POST /api/v1/terms. Scope + target are locked in after create. */
export interface CreateTermsDocumentRequest {
  scope: TermsScope;
  customerId?: number | null;
  partId?: number | null;
  title: string;
  summary?: string | null;
  bodyMarkdown: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
  sortOrder: number;
}
