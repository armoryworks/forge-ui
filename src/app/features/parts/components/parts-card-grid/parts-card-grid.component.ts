import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { PartsService } from '../../services/parts.service';
import { PartListItem } from '../../models/part-list-item.model';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-parts-card-grid',
  standalone: true,
  imports: [TranslatePipe, LoadingBlockDirective, EmptyStateComponent],
  templateUrl: './parts-card-grid.component.html',
  styleUrl: './parts-card-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartsCardGridComponent {
  private readonly partsService = inject(PartsService);

  readonly parts = input<PartListItem[]>([]);
  readonly selectedPartId = input<number | null>(null);

  readonly partClick = output<PartListItem>();

  protected readonly isLoading = signal(false);
  protected readonly thumbnailMap = signal<Record<number, string | null>>({});

  constructor() {
    effect(() => {
      const partIds = this.parts().map(p => p.id);
      this.loadThumbnails(partIds);
    });
  }

  private loadThumbnails(partIds: number[]): void {
    if (partIds.length === 0) {
      this.thumbnailMap.set({});
      return;
    }
    this.isLoading.set(true);
    this.partsService.getPartThumbnails(partIds).subscribe({
      next: (results) => {
        const map: Record<number, string | null> = {};
        for (const r of results) {
          map[r.partId] = r.thumbnailUrl;
        }
        this.thumbnailMap.set(map);
        this.isLoading.set(false);
      },
      error: () => {
        this.thumbnailMap.set({});
        this.isLoading.set(false);
      },
    });
  }

  protected getStatusClass(status: string): string {
    switch (status) {
      case 'Active': return 'status-badge--active';
      case 'Draft': return 'status-badge--draft';
      case 'Prototype': return 'status-badge--prototype';
      case 'Obsolete': return 'status-badge--obsolete';
      default: return '';
    }
  }

  protected onCardClick(part: PartListItem): void {
    this.partClick.emit(part);
  }
}
