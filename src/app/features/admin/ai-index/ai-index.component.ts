import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { concatMap, finalize, from, tap } from 'rxjs';

import { AiService } from '../../../shared/services/ai.service';
import { AiIndexEntityStatus, AiIndexStatus } from '../../../shared/models/ai-index-status.model';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { ToolbarComponent } from '../../../shared/components/toolbar/toolbar.component';
import { SpacerDirective } from '../../../shared/directives/spacer.directive';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { DateTimePipe } from '../../../shared/pipes/date-time.pipe';

/**
 * AI search index — how much of each record type is in the assistant's search index and when it
 * was last indexed, with a re-index of one type or of everything. A full re-index runs one record
 * type at a time so the screen can show how far it has got.
 */
@Component({
  selector: 'app-ai-index',
  standalone: true,
  imports: [
    TranslatePipe, DateTimePipe, DecimalPipe,
    PageLayoutComponent, ToolbarComponent, SpacerDirective,
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
  ],
  templateUrl: './ai-index.component.html',
  styleUrl: './ai-index.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiIndexComponent {
  private readonly ai = inject(AiService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly status = signal<AiIndexStatus | null>(null);
  protected readonly loading = signal(true);
  protected readonly indexingType = signal<string | null>(null);
  protected readonly progress = signal<{ done: number; total: number } | null>(null);
  protected readonly busy = computed(() => this.indexingType() !== null || this.progress() !== null);
  protected readonly progressPercent = computed(() => {
    const p = this.progress();
    return p && p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'entityType', header: this.translate.instant('aiIndexAdmin.cols.entityType'), sortable: true },
    { field: 'indexedCount', header: this.translate.instant('aiIndexAdmin.cols.indexed'), width: '160px', align: 'right' },
    { field: 'chunkCount', header: this.translate.instant('aiIndexAdmin.cols.chunks'), width: '110px', align: 'right' },
    { field: 'lastIndexedAt', header: this.translate.instant('aiIndexAdmin.cols.lastIndexed'), type: 'date', width: '180px' },
    { field: 'actions', header: '', width: '140px', align: 'right' },
  ];

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.ai.indexStatus().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (status) => {
        this.status.set(status);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected typeLabel(entityType: string): string {
    return this.translate.instant(`aiIndexAdmin.entityTypes.${entityType}`);
  }

  protected indexType(row: AiIndexEntityStatus): void {
    this.indexingType.set(row.entityType);
    this.ai.bulkIndex(row.entityType).pipe(finalize(() => this.indexingType.set(null))).subscribe({
      next: (result) => {
        this.snackbar.success(this.translate.instant('aiIndexAdmin.typeIndexed', {
          type: this.typeLabel(row.entityType), chunks: result.totalChunksIndexed,
        }));
        this.load();
      },
      error: (err: unknown) => this.snackbar.errorFrom(err, 'aiIndexAdmin.indexFailed'),
    });
  }

  protected reindexAll(): void {
    const types = (this.status()?.entityTypes ?? []).map(t => t.entityType);
    if (types.length === 0) return;
    let chunks = 0;
    this.progress.set({ done: 0, total: types.length });
    from(types).pipe(
      concatMap(type => {
        this.indexingType.set(type);
        return this.ai.bulkIndex(type).pipe(tap(result => {
          chunks += result.totalChunksIndexed;
          this.progress.update(p => (p ? { ...p, done: p.done + 1 } : p));
        }));
      }),
      finalize(() => {
        this.indexingType.set(null);
        this.progress.set(null);
        this.load();
      }),
    ).subscribe({
      complete: () => this.snackbar.success(this.translate.instant('aiIndexAdmin.allIndexed', { chunks })),
      error: (err: unknown) => this.snackbar.errorFrom(err, 'aiIndexAdmin.indexFailed'),
    });
  }
}
