import { TermsScope } from './terms-scope.model';

/**
 * A terms & conditions document.
 *
 * `scope` + the matching target id (`customerId` for Customer scope, `partId`
 * for Part scope) are set at create time and immutable thereafter. `version`
 * is bumped server-side on every edit and is display-only in the UI.
 *
 * `customerName` / `partName` are optional display-only fields the API may
 * join in for list rendering; the UI falls back to the id when absent.
 */
export interface TermsDocument {
  id: number;
  scope: TermsScope;
  customerId?: number | null;
  partId?: number | null;
  customerName?: string | null;
  partName?: string | null;
  title: string;
  summary?: string | null;
  bodyMarkdown: string;
  version: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
  sortOrder: number;
  sourceFileAttachmentId?: number | null;
}
