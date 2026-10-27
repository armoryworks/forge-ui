import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TranslatePipe } from '@ngx-translate/core';

import { BOMLine } from '../../models/bom-line.model';
import { BomTreeNode } from '../../models/bom-tree-node.model';
import { PartsService } from '../../services/parts.service';
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
  private readonly partsService = inject(PartsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly entries = input<BOMLine[]>([]);
  readonly entryDelete = output<BOMLine>();

  protected readonly expandedKeys = signal<Set<string>>(new Set());
  private readonly childLines = signal<Map<number, BOMLine[]>>(new Map());
  private readonly loadingPartIds = signal<Set<number>>(new Set());
  private readonly failedPartIds = signal<Set<number>>(new Set());

  /**
   * Builds the tree from the part's own BOM lines (level 0). A line whose child part has a BOM of
   * its own can be expanded at any depth; its lines are fetched the first time it is opened. A
   * child that already appears higher on the same branch is not expandable, so a BOM cycle cannot
   * recurse.
   */
  protected readonly treeNodes = computed<BomTreeNode[]>(() =>
    this.buildNodes(this.entries(), 0, '', new Set<number>()));

  /** Flattened visible nodes respecting expand state. */
  protected readonly flattenedNodes = computed<BomTreeNode[]>(() => {
    const result: BomTreeNode[] = [];
    this.walkNodes(this.treeNodes(), result);
    return result;
  });

  private buildNodes(lines: BOMLine[], level: number, parentKey: string, ancestors: Set<number>): BomTreeNode[] {
    const expanded = this.expandedKeys();
    const loaded = this.childLines();
    const loading = this.loadingPartIds();
    const failed = this.failedPartIds();
    return lines.map(entry => {
      const key = `${parentKey}/${entry.id}`;
      const hasChildren = !!entry.childHasBom && !ancestors.has(entry.childPartId);
      const isExpanded = hasChildren && expanded.has(key);
      const childEntries = isExpanded ? loaded.get(entry.childPartId) : undefined;
      const children = childEntries
        ? this.buildNodes(childEntries, level + 1, key, new Set([...ancestors, entry.childPartId]))
        : [];
      return {
        key,
        entry,
        level,
        isExpanded,
        isLoading: isExpanded && loading.has(entry.childPartId),
        loadFailed: isExpanded && failed.has(entry.childPartId),
        hasChildren,
        children,
      };
    });
  }

  private walkNodes(nodes: BomTreeNode[], result: BomTreeNode[]): void {
    for (const node of nodes) {
      result.push(node);
      if (node.isExpanded && node.children.length > 0) {
        this.walkNodes(node.children, result);
      }
    }
  }

  protected toggleExpand(node: BomTreeNode): void {
    const opening = !this.expandedKeys().has(node.key);
    this.expandedKeys.update(keys => {
      const next = new Set(keys);
      if (opening) next.add(node.key);
      else next.delete(node.key);
      return next;
    });
    if (opening) this.loadChildren(node.entry.childPartId);
  }

  protected retryChildren(node: BomTreeNode): void {
    this.loadChildren(node.entry.childPartId);
  }

  private loadChildren(partId: number): void {
    if (this.childLines().has(partId) || this.loadingPartIds().has(partId)) return;
    this.failedPartIds.update(ids => {
      const next = new Set(ids);
      next.delete(partId);
      return next;
    });
    this.loadingPartIds.update(ids => new Set(ids).add(partId));
    this.partsService.getPartById(partId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: part => {
        const lines = [...(part.bomLines ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
        this.childLines.update(map => new Map(map).set(partId, lines));
        this.finishLoading(partId);
      },
      error: () => {
        this.failedPartIds.update(ids => new Set(ids).add(partId));
        this.finishLoading(partId);
      },
    });
  }

  private finishLoading(partId: number): void {
    this.loadingPartIds.update(ids => {
      const next = new Set(ids);
      next.delete(partId);
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

  protected onDelete(entry: BOMLine): void {
    this.entryDelete.emit(entry);
  }
}
