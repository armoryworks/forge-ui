import { JournalPartyType } from './journal-template.model';

/** A customer or vendor a control-account line can name (`GET accounting/journal-templates/parties`). */
export interface JournalPartyOption {
  partyType: JournalPartyType;
  id: number;
  name: string;
}
