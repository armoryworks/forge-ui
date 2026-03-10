export interface PartInventorySummary {
  totalQuantity: number;
  binLocations: PartBinLocation[];
}

export interface PartBinLocation {
  locationPath: string;
  quantity: number;
}
