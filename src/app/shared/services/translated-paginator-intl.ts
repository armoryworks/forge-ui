import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslateService } from '@ngx-translate/core';

const KEYS = [
  'paginator.itemsPerPage',
  'paginator.nextPage',
  'paginator.previousPage',
  'paginator.firstPage',
  'paginator.lastPage',
] as const;

@Injectable()
export class TranslatedPaginatorIntl extends MatPaginatorIntl {
  private readonly translate = inject(TranslateService);

  constructor() {
    super();
    this.translate.stream([...KEYS]).pipe(takeUntilDestroyed()).subscribe((labels: Record<string, string>) => {
      this.itemsPerPageLabel = labels['paginator.itemsPerPage'];
      this.nextPageLabel = labels['paginator.nextPage'];
      this.previousPageLabel = labels['paginator.previousPage'];
      this.firstPageLabel = labels['paginator.firstPage'];
      this.lastPageLabel = labels['paginator.lastPage'];
      this.changes.next();
    });
  }

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0 || pageSize === 0) {
      return this.translate.instant('paginator.rangeEmpty', { length });
    }
    const total = Math.max(length, 0);
    const start = page * pageSize;
    const end = start < total ? Math.min(start + pageSize, total) : start + pageSize;
    return this.translate.instant('paginator.range', { start: start + 1, end, length: total });
  };
}
