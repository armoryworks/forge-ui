export interface ReplenishmentCardTriggerLog {
  id: number;
  triggerType: string;
  triggeredAt: string;
  fulfilledAt: string | null;
  requestedQuantity: number;
  fulfilledQuantity: number | null;
  orderId: number | null;
  orderType: string | null;
  triggeredByName: string | null;
}
