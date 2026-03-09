import { Stage } from './stage.model';

export interface TrackType {
  id: number;
  name: string;
  code: string;
  description: string | null;
  isDefault: boolean;
  sortOrder: number;
  stages: Stage[];
}
