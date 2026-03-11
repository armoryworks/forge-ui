export interface StatusEntry {
  id: number;
  entityType: string;
  entityId: number;
  statusCode: string;
  statusLabel: string;
  category: 'workflow' | 'hold';
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  setById: number | null;
  setByName: string | null;
  createdAt: string;
}
