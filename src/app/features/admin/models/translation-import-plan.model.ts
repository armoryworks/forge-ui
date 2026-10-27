import { TranslationImportChange } from './translation-import-change.model';

export interface TranslationImportPlan {
  changes: TranslationImportChange[];
  unchangedCount: number;
  unknownKeys: string[];
}
