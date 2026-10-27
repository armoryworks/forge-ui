import { JournalTemplateLine } from './journal-template.model';

/** Create (`POST`, with `bookId`) or replace (`PUT`, with `isActive`) a journal template. */
export interface JournalTemplateInput {
  bookId?: number;
  name: string;
  description: string | null;
  memo: string | null;
  autoReverseNextPeriod: boolean;
  isActive?: boolean;
  lines: JournalTemplateLine[];
}
