import { ReplenishmentCard } from './replenishment-card.model';
import { ReplenishmentCardTriggerLog } from './replenishment-card-trigger-log.model';

export interface ReplenishmentCardDetail {
  card: ReplenishmentCard;
  triggerLogs: ReplenishmentCardTriggerLog[];
}
