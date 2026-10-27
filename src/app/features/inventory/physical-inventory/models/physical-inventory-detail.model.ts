import { PhysicalInventory } from './physical-inventory.model';
import { PhysicalInventoryTag } from './physical-inventory-tag.model';

export interface PhysicalInventoryDetail extends PhysicalInventory {
  tags: PhysicalInventoryTag[];
}
