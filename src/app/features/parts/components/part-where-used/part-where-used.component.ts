import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { PartWhereUsed } from '../../models/part-where-used.model';
import { PartWhereUsedService } from '../../services/part-where-used.service';

@Component({
  selector: 'app-part-where-used',
  standalone: true,
  imports: [TranslatePipe, DataTableComponent, ColumnCellDirective],
  templateUrl: './part-where-used.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartWhereUsedComponent {
  private readonly whereUsedService = inject(PartWhereUsedService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly partId = input.required<number>();
  readonly partOpened = output<number>();

  protected readonly rows = signal<PartWhereUsed[]>([]);
  protected readonly loading = signal(false);

  protected readonly columns: ColumnDef[] = [
    { field: 'parentPartNumber', header: this.translate.instant('partBom.whereUsed.parentPart'), sortable: true },
    { field: 'parentName', header: this.translate.instant('partBom.whereUsed.parentName'), sortable: true },
    { field: 'parentRevision', header: this.translate.instant('partBom.whereUsed.revision'), width: '80px', align: 'center' },
    { field: 'quantityPer', header: this.translate.instant('partBom.whereUsed.quantityPer'), width: '90px', align: 'right', type: 'number', sortable: true },
    { field: 'sourceType', header: this.translate.instant('partBom.whereUsed.source'), width: '90px', sortable: true },
    { field: 'openWorkOrderCount', header: this.translate.instant('partBom.whereUsed.openWorkOrders'), width: '130px', align: 'right', type: 'number', sortable: true },
  ];

  constructor() {
    effect(() => this.load(this.partId()));
  }

  protected openPart(row: unknown): void {
    const item = row as PartWhereUsed;
    if (item?.parentPartId) this.partOpened.emit(item.parentPartId);
  }

  protected sourceLabel(source: string): string {
    return this.translate.instant(`parts.source${source}`);
  }

  private load(partId: number): void {
    this.loading.set(true);
    this.whereUsedService.getWhereUsed(partId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.rows.set([]);
        this.loading.set(false);
      },
    });
  }
}
