import { TerminologyEntryItem } from './terminology-entry-item.model';

export interface TerminologySaveResult {
  entries: TerminologyEntryItem[];
  untranslatedTerms: string[];
}
