import { LinkableEntityType } from '../components/entity-link/entity-link.component';

/** A single label/value row in an entity preview. */
export interface PreviewField {
  label: string;
  value: string;
}

/** A jump target to a related record in an entity preview. */
export interface PreviewLink {
  type: LinkableEntityType;
  id: number;
  label: string;
}

/** Lightweight, non-sensitive summary of a linked record for the hover popover. */
export interface EntityPreview {
  type: string;
  id: number;
  title: string;
  subtitle: string | null;
  fields: PreviewField[];
  links: PreviewLink[];
}
