import { BomExplosionChildJob } from './bom-explosion-child-job.model';
import { BomExplosionBuyItem } from './bom-explosion-buy-item.model';
import { BomExplosionStockItem } from './bom-explosion-stock-item.model';

export interface BomExplosionResponse {
  parentJobId: number;
  createdJobs: BomExplosionChildJob[];
  buyItems: BomExplosionBuyItem[];
  stockItems: BomExplosionStockItem[];
}
