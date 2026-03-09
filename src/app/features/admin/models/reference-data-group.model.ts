import { ReferenceDataEntry } from './reference-data-entry.model';

export interface ReferenceDataGroup {
  groupCode: string;
  values: ReferenceDataEntry[];
}
