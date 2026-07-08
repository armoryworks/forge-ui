/**
 * One compiled section of a quote's terms preview — a company / customer /
 * line-part terms document flattened for display in the send-email dialog.
 */
export interface TermsPreviewSection {
  title: string;
  summary?: string | null;
  bodyMarkdown: string;
}
