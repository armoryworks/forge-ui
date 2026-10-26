/** Body for POST /shipments/{id}/pickup: ISO timestamps carrying the pickup location's UTC offset. */
export interface SchedulePickupRequest {
  readyTime: string;
  closeTime: string;
  instructions: string | null;
}
