/** A company-owned operational asset a fixed asset may book (`GET accounting/fixed-assets/linkable-assets`). */
export interface LinkableAsset {
  id: number;
  name: string;
  serialNumber: string | null;
  acquisitionCost: number | null;
  currentShotCount: number;
  linkedFixedAssetId: number | null;
}
