import { TermsPreviewSection } from './quote-terms-preview-section.model';

/** Response of GET /api/v1/quotes/{id}/terms/preview. */
export interface QuoteTermsPreview {
  sections: TermsPreviewSection[];
}
