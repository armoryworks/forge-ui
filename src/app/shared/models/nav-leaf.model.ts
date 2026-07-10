/**
 * Flattened, permission-filtered navigable page — produced by
 * NavTreeService.flatLeaves for the header global search, so screens
 * (not just entities) are findable via Ctrl+K.
 */
export interface NavLeaf {
  icon: string;
  label: string;
  i18nKey?: string;
  route: string;
  /** i18n keys (or raw labels) of the ancestor groups, outermost first. */
  trailKeys: string[];
}
