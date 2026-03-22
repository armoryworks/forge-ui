import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { BOMEntry } from '../../models/bom-entry.model';
import { BomTreeNode } from '../../models/bom-tree-node.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-bom-tree',
  standalone: true,
  imports: [TranslatePipe, EmptyStateComponent],
  templateUrl: './bom-tree.component.html',
  styleUrl: './bom-tree.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BomTreeComponent {
  readonly entries = input<BOMEntry[]>([]);
  readonly entryDelete = output<BOMEntry>();

  protected readonly expandedIds = signal<Set<number>>(new Set());

  /** Builds tree nodes from flat BOM entry list (all entries are root-level children). */
  protected readonly treeNodes = computed<BomTreeNode[]>(() => {
    return this.entries().map(entry => ({
      entry,
      level: 0,
      isExpanded: this.expandedIds().has(entry.id),
      hasChildren: false,
      children: [],
    }));
  });

  /** Flattened visible nodes respecting expand state. */
  protected readonly flattenedNodes = computed<BomTreeNode[]>(() => {
    const result: BomTreeNode[] = [];
    this.walkNodes(this.treeNodes(), result);
    return result;
  });

  private walkNodes(nodes: BomTreeNode[], result: BomTreeNode[]): void {
    for (const node of nodes) {
      result.push(node);
      if (node.isExpanded && node.children.length > 0) {
        this.walkNodes(node.children, result);
      }
    }
  }

  protected toggleExpand(nodeId: number): void {
    this.expandedIds.update(ids => {
      const next = new Set(ids);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }

  protected getSourceClass(sourceType: string): string {
    switch (sourceType) {
      case 'Make': return 'source-chip--make';
      case 'Stock': return 'source-chip--stock';
      default: return '';
    }
  }

  protected onDelete(entry: BOMEntry): void {
    this.entryDelete.emit(entry);
  }
}
