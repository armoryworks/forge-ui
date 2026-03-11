import { TrackingEvent } from './tracking-event.model';

export interface ShipmentTracking {
  trackingNumber: string;
  status: string;
  estimatedDelivery: string | null;
  events: TrackingEvent[];
}
