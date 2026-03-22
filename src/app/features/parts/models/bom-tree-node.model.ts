import { BOMEntry } from './bom-entry.model';

export interface BomTreeNode {
  entry: BOMEntry;
  level: number;
  isExpanded: boolean;
  hasChildren: boolean;
  children: BomTreeNode[];
}
