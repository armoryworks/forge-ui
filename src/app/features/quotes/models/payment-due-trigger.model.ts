/**
 * When a payment milestone becomes due. Mirrors the server enum
 * `Forge.Core.Enums.PaymentDueTrigger` (serialized as strings).
 * FixedDate requires a dueDate; NetDays requires a netDays count.
 */
export type PaymentDueTrigger =
  | 'OnAcceptance'
  | 'OnOrderConfirmation'
  | 'OnProductionStart'
  | 'OnShipment'
  | 'OnDelivery'
  | 'FixedDate'
  | 'NetDays';
