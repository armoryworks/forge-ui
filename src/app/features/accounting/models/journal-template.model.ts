export type JournalPartyType = 'Customer' | 'Vendor';

/** One template line: an explicit account or a determination key, with a fixed amount or none (entered at post time). */
export interface JournalTemplateLine {
  accountDeterminationKey: string | null;
  glAccountId: number | null;
  debit: number;
  credit: number;
  description: string | null;
  partyType: JournalPartyType | null;
  partyId: number | null;
}

/** A journal template with its lines (`GET accounting/journal-templates`). */
export interface JournalTemplate {
  id: number;
  bookId: number;
  name: string;
  description: string | null;
  memo: string | null;
  autoReverseNextPeriod: boolean;
  isActive: boolean;
  lines: JournalTemplateLine[];
}
