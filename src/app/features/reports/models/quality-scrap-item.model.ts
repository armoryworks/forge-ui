export interface QualityScrapItem {
  partId: number;
  partNumber: string;
  totalProduced: number;
  totalScrapped: number;
  scrapRate: number;
  yieldRate: number;
}
