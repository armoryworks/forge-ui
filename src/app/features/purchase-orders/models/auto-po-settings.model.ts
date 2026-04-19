export interface AutoPoSettings {
  enabled: boolean;
  defaultMode: AutoPoMode;
  bufferDays: number;
  notifyChat: boolean;
}

export interface UpdateAutoPoSettingsRequest {
  enabled?: boolean;
  defaultMode?: string;
  bufferDays?: number;
  notifyChat?: boolean;
}

export type AutoPoMode = 'Suggest' | 'Draft' | 'Automatic';
