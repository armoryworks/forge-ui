import { TermsScope } from './terms-scope.model';

/**
 * Payload for PUT /api/v1/terms/{id}. Carries scope + target for parity with
 * create, but the server treats them as immutable (they must match the stored
 * document). `version` is server-managed and never sent.
 */
export interface UpdateTermsDocumentRequest {
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
