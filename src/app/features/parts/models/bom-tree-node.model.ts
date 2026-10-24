import { BOMLine } from './bom-line.model';

export interface BomTreeNode {
  key: string;
  entry: BOMLine;
  level: number;
  isExpanded: boolean;
  isLoading: boolean;
  hasChildren: boolean;
  children: BomTreeNode[];
}
