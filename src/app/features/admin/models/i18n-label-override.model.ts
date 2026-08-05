export interface I18nLabelOverride {
  id: number;
  key: string;
  languageCode: string;
  value: string;
  isMachineTranslated: boolean;
  isPendingTranslation: boolean;
  sourceLanguageCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertI18nLabelOverrideRequest {
  key: string;
  languageCode: string;
  value: string;
  translateToOtherLanguages: boolean;
}

export interface UpsertI18nLabelOverrideResult {
  overrides: I18nLabelOverride[];
  translationsPending: boolean;
}

export interface RetryPendingI18nTranslationsResult {
  translatedCount: number;
  stillPendingCount: number;
}
