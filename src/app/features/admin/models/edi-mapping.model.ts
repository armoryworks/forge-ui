export interface EdiMapping {
  id: number;
  tradingPartnerId: number;
  transactionSet: string;
  name: string;
  fieldMappingsJson: string;
  valueTranslationsJson: string;
  isDefault: boolean;
  notes: string | null;
}
