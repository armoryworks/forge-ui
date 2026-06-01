import { BOMLine } from './bom-line.model';

export interface BomTreeNode {
  entry: BOMLine;
  level: number;
  isExpanded: boolean;
  hasChildren: boolean;
  children: BomTreeNode[];
}
