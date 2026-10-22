const CONTENT_TYPE_ICONS: Record<string, string> = {
  Article: 'article',
  Video: 'play_circle',
  Walkthrough: 'route',
  QuickRef: 'fact_check',
  Quiz: 'quiz',
  Reference: 'menu_book',
};

/**
 * The Material Icons Outlined ligature for a training module's content type.
 * Every name here exists in the bundled outlined font, so no raw icon name
 * renders as text; an unknown type falls back to `school`.
 */
export function trainingContentIcon(type: string | null | undefined): string {
  return (type && CONTENT_TYPE_ICONS[type]) || 'school';
}
