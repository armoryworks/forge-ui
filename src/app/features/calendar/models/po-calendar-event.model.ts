export interface PoCalendarEvent {
  id: number;
  poNumber: string;
  vendorName: string;
  expectedDeliveryDate: string; // YYYY-MM-DD (DateOnly serialized)
  status: string;
  lineCount: number;
}
