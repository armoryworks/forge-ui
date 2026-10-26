/** A carrier's confirmation of a scheduled pickup. Mirrors PickupConfirmation. */
export interface PickupConfirmation {
  confirmationNumber: string;
  scheduledDate: string;
  carrierName: string;
}
