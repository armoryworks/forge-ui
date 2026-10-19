import { BankingSettingField } from './banking-setting-field.model';

export interface BankingSettingSection {
  id: string;
  titleKey: string;
  fields: BankingSettingField[];
}
