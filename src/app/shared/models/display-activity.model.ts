import { ActivityItem } from './activity.model';

export interface DisplayActivity extends ActivityItem {
  batchedItems?: ActivityItem[];
}
