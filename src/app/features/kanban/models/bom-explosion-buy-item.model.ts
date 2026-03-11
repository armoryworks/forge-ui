export interface BomExplosionBuyItem {
  partId: number;
  partNumber: string;
  description: string;
  quantity: number;
  preferredVendorId: number | null;
  preferredVendorName: string | null;
  leadTimeDays: number | null;
}
