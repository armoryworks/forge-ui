export interface SyncConflict {
  entryId: string;
  description: string;
  url: string;
  method: string;
  localValue: unknown;
  serverMessage: string;
}

export type SyncConflictResolution = 'keep-mine' | 'keep-server' | 'cancel';
