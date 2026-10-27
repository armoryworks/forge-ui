import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { ReferenceDataItem } from '../../../../shared/services/reference-data.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { MaterialSpecDialogComponent, MaterialSpecDialogData } from '../../components/material-spec-dialog/material-spec-dialog.component';
import {
  MaterialSpecRenameDialogComponent, MaterialSpecRenameDialogData,
} from '../../components/material-spec-rename-dialog/material-spec-rename-dialog.component';
import { MaterialSpec } from '../../models/material-spec.model';
import { MaterialSpecService } from '../../services/material-spec.service';

/**
 * Parts > Material specs: the material categories and specs parts pick from, managed on their own so a spec can
 * exist before any part uses it. Retiring hides a spec from the part pickers without touching the parts that
 * already use it.
 */
@Component({
  selector: 'app-material-specs-page',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatTooltipModule, TranslatePipe,
    PageLayoutComponent, DataTableComponent, ColumnCellDirective, ToggleComponent,
  ],
  templateUrl: './material-specs.component.html',
  styleUrl: './material-specs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaterialSpecsPageComponent {
  private readonly materialSpecs = inject(MaterialSpecService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly specs = signal<MaterialSpec[]>([]);
  protected readonly loading = signal(false);
  protected readonly showRetired = new FormControl(false, { nonNullable: true });

  protected readonly columns: ColumnDef[] = [
    { field: 'label', header: this.translate.instant('materialSpecs.name'), sortable: true },
    { field: 'categoryLabel', header: this.translate.instant('materialSpecs.category'), sortable: true, width: '200px' },
    { field: 'partCount', header: this.translate.instant('parts.materialSpecsPage.partCount'), sortable: true, type: 'number', align: 'right', width: '110px' },
    { field: 'isActive', header: this.translate.instant('parts.materialSpecsPage.status'), sortable: true, width: '120px' },
    { field: 'actions', header: '', width: '100px', align: 'center' },
  ];

  constructor() {
    this.load();
    this.showRetired.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  protected load(): void {
    this.loading.set(true);
    this.materialSpecs.list(this.showRetired.value).subscribe({
      next: specs => {
        this.specs.set(specs);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.snackbar.errorFrom(err, 'parts.materialSpecsPage.loadFailed');
      },
    });
  }

  protected openCreate(): void {
    const items: ReferenceDataItem[] = this.specs().map(spec => ({
      id: spec.id, groupCode: 'part.material_spec', code: spec.code, label: spec.label,
      sortOrder: spec.sortOrder, isActive: spec.isActive, parentId: spec.parentId,
    }));
    this.dialog.open(MaterialSpecDialogComponent, {
      width: '480px',
      data: { items } satisfies MaterialSpecDialogData,
    }).afterClosed().subscribe(created => {
      if (created) this.load();
    });
  }

  protected openRename(spec: MaterialSpec): void {
    this.dialog.open(MaterialSpecRenameDialogComponent, {
      width: '420px',
      data: { spec } satisfies MaterialSpecRenameDialogData,
    }).afterClosed().subscribe(updated => {
      if (updated) this.load();
    });
  }

  protected setActive(spec: MaterialSpec, active: boolean): void {
    const call = active ? this.materialSpecs.reactivate(spec.id) : this.materialSpecs.retire(spec.id);
    call.subscribe({
      next: updated => {
        this.snackbar.success(this.translate.instant(
          active ? 'parts.materialSpecsPage.reactivated' : 'parts.materialSpecsPage.retired', { name: updated.label }));
        this.load();
      },
      error: (err: unknown) => this.snackbar.errorFrom(
        err, active ? 'parts.materialSpecsPage.reactivateFailed' : 'parts.materialSpecsPage.retireFailed'),
    });
  }
}
