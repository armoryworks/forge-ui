export interface TranslationImportChange {
  key: string;
  currentValue: string;
  newValue: string;
  shippedValue: string;
  revertsToShipped: boolean;
}
