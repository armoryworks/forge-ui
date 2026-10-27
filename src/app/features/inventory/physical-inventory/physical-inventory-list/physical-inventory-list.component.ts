import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PhysicalInventoryService } from '../services/physical-inventory.service';
import { PhysicalInventory } from '../models/physical-inventory.model';
import { PhysicalInventoryStatus } from '../models/physical-inventory-status.type';
import { physicalInventoryStatusChip } from '../physical-inventory-status';
import { PhysicalInventoryCreateDialogComponent } from '../components/physical-inventory-create-dialog/physical-inventory-create-dialog.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { AuthService } from '../../../../shared/services/auth.service';

const STATUSES: PhysicalInventoryStatus[] = ['Draft', 'Frozen', 'Counting', 'Review', 'Posted', 'Cancelled'];

/**
 * Inventory > Physical inventory: the list of full counts, newest first. Admin and Manager start a new one; the
 * stock roles open a count to enter tags.
 */
@Component({
  selector: 'app-physical-inventory-list',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    PageHeaderComponent, SelectComponent, DataTableComponent, CurrencyDisplayComponent, ColumnCellDirective, LoadingBlockDirective,
    PhysicalInventoryCreateDialogComponent,
  ],
  templateUrl: './physical-inventory-list.component.html',
  styleUrl: './physical-inventory-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhysicalInventoryListComponent {
  private readonly service = inject(PhysicalInventoryService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(false);
  protected readonly inventories = signal<PhysicalInventory[]>([]);
  protected readonly showCreate = signal(false);
  protected readonly canManage = computed(() => this.auth.hasAnyRole(['Admin', 'Manager']));

  protected readonly statusControl = new FormControl<PhysicalInventoryStatus | null>(null);
  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('common.allStatuses') },
    ...STATUSES.map(s => ({ value: s, label: this.translate.instant(`physicalInventory.status.${s}`) })),
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'inventoryNumber', header: this.translate.instant('physicalInventory.number'), sortable: true, width: '130px' },
    { field: 'description', header: this.translate.instant('common.description'), sortable: true },
    { field: 'scopeLocationName', header: this.translate.instant('physicalInventory.scope'), sortable: true, phoneHidden: true },
    { field: 'countDate', header: this.translate.instant('physicalInventory.countDate'), sortable: true, type: 'date', width: '120px' },
    { field: 'progress', header: this.translate.instant('physicalInventory.progress'), sortable: false, width: '130px', align: 'right' },
    { field: 'totalVarianceValue', header: this.translate.instant('physicalInventory.netVariance'), sortable: true, align: 'right', width: '130px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '130px' },
  ];

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const status = params.get('status') as PhysicalInventoryStatus | null;
      this.statusControl.setValue(status && STATUSES.includes(status) ? status : null, { emitEvent: false });
      this.load();
    });
    this.statusControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(status => {
      void this.router.navigate([], { relativeTo: this.route, queryParams: { status }, queryParamsHandling: 'merge' });
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.service.list(this.statusControl.value).subscribe({
      next: list => {
        this.inventories.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected open(row: unknown): void {
    void this.router.navigate(['/inventory/physical-inventory', (row as PhysicalInventory).id]);
  }

  protected onCreated(id: number): void {
    this.showCreate.set(false);
    void this.router.navigate(['/inventory/physical-inventory', id]);
  }

  protected statusClass(status: string): string {
    return physicalInventoryStatusChip(status);
  }
}
