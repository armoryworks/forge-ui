/** Body for POST /pick-waves/{id}/lines/{lineId}/confirm. */
export interface ConfirmPickLineRequest {
  pickedQuantity: number;
  shortNotes: string | null;
}
