import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { Observable, forkJoin } from 'rxjs';

import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { SpacerDirective } from '../../../shared/directives/spacer.directive';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { AdminService } from '../services/admin.service';
import { PlantService } from '../services/plant.service';
import { CompanyLocation } from '../models/company-location.model';
import { Plant } from '../models/plant.model';
import { PlantRequest } from '../models/plant-request.model';
import { PlantDialogComponent, PlantDialogData } from './plant-dialog.component';

/** Admin > Plants: the operating sites of a multi-plant install, each tied to a company location (its address). */
@Component({
  selector: 'app-plants-admin',
  standalone: true,
  imports: [TranslatePipe, PageLayoutComponent, SpacerDirective, DataTableComponent, ColumnCellDirective, LoadingBlockDirective],
  templateUrl: './plants-admin.component.html',
  styleUrl: './plants-admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlantsAdminComponent {
  private readonly plantService = inject(PlantService);
  private readonly admin = inject(AdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly plants = signal<Plant[]>([]);
  protected readonly locations = signal<CompanyLocation[]>([]);
  protected readonly loading = signal(true);

  protected readonly columns: ColumnDef[] = [
    { field: 'code', header: this.translate.instant('admin.plants.code'), sortable: true, width: '120px' },
    { field: 'name', header: this.translate.instant('admin.plants.name'), sortable: true },
    { field: 'locationName', header: this.translate.instant('admin.plants.location'), sortable: true },
    { field: 'timeZone', header: this.translate.instant('admin.plants.timeZone'), sortable: true, width: '180px' },
    { field: 'currencyCode', header: this.translate.instant('admin.plants.currency'), sortable: true, width: '100px' },
    { field: 'isDefault', header: this.translate.instant('admin.plants.isDefault'), width: '100px', align: 'center' },
    { field: 'isActive', header: this.translate.instant('common.active'), sortable: true, width: '90px', align: 'center' },
  ];

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    forkJoin({ plants: this.plantService.list(), locations: this.admin.getCompanyLocations() }).subscribe({
      next: ({ plants, locations }) => {
        this.plants.set(plants);
        this.locations.set(locations);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openNew(): void {
    this.openDialog({ locations: this.locations() });
  }

  protected openEdit(plant: Plant): void {
    this.openDialog({ plant, locations: this.locations() });
  }

  private openDialog(data: PlantDialogData): void {
    this.dialog.open<PlantDialogComponent, PlantDialogData, PlantRequest>(PlantDialogComponent, { width: '520px', data })
      .afterClosed()
      .subscribe(request => {
        if (!request) return;
        const save: Observable<unknown> = data.plant ? this.plantService.update(data.plant.id, request) : this.plantService.create(request);
        save.subscribe({
          next: () => {
            this.snackbar.success(this.translate.instant('admin.plants.saved'));
            this.load();
          },
          error: (err: unknown) => this.snackbar.errorFrom(err, 'admin.plants.saveFailed'),
        });
      });
  }
}
