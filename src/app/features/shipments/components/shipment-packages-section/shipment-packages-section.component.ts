import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MatDialog } from '@angular/material/dialog';

import { ShipmentService } from '../../services/shipment.service';
import { ShipmentPackage } from '../../models/shipment-package.model';
import { CreateShipmentPackageRequest } from '../../models/create-shipment-package-request.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

/**
 * The cartons a shipment goes out in: weight, dimensions and tracking per package, with the count and total
 * weight the carrier rates are quoted on. Packages can be added, corrected and removed while the shipment is
 * still editable.
 */
@Component({
  selector: 'app-shipment-packages-section',
  standalone: true,
  imports: [
    DecimalPipe, ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, ValidationButtonComponent, LoadingBlockDirective, DataTableComponent, ColumnCellDirective,
  ],
  templateUrl: './shipment-packages-section.component.html',
  styleUrl: './shipment-packages-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShipmentPackagesSectionComponent {
  private readonly shipmentService = inject(ShipmentService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly shipmentId = input.required<number>();
  readonly editable = input(true);
  readonly changed = output<void>();

  protected readonly packages = signal<ShipmentPackage[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<ShipmentPackage | null>(null);
  protected readonly showForm = signal(false);

  protected readonly columns = computed<ColumnDef[]>(() => [
    { field: 'weight', header: this.translate.instant('shipments.packages.weight'), sortable: true, align: 'right', width: '110px' },
    { field: 'dimensions', header: this.translate.instant('shipments.packages.dimensions'), exportable: false },
    { field: 'trackingNumber', header: this.translate.instant('shipments.packages.tracking'), sortable: true },
    ...(this.editable() ? [{ field: 'actions', header: this.translate.instant('common.actions'), width: '90px', align: 'right' as const, exportable: false }] : []),
  ]);

  protected readonly totalWeight = computed(() =>
    this.packages().reduce((sum, p) => sum + (p.weight ?? 0), 0));

  protected readonly form = new FormGroup({
    weight: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    length: new FormControl<number | null>(null, [Validators.min(0)]),
    width: new FormControl<number | null>(null, [Validators.min(0)]),
    height: new FormControl<number | null>(null, [Validators.min(0)]),
    trackingNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    weight: this.translate.instant('shipments.packages.weight'),
    length: this.translate.instant('shipments.packages.length'),
    width: this.translate.instant('shipments.packages.width'),
    height: this.translate.instant('shipments.packages.height'),
    trackingNumber: this.translate.instant('shipments.packages.tracking'),
  });

  constructor() {
    effect(() => {
      const id = this.shipmentId();
      untracked(() => this.load(id));
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.shipmentService.getPackages(id).subscribe({
      next: rows => { this.packages.set(rows); this.loading.set(false); },
      error: (err: unknown) => { this.loading.set(false); this.snackbar.errorFrom(err, 'shipments.packages.loadFailed'); },
    });
  }

  protected openAdd(): void {
    this.editing.set(null);
    this.form.reset({ weight: null, length: null, width: null, height: null, trackingNumber: '' });
    this.showForm.set(true);
  }

  protected openEdit(pkg: ShipmentPackage): void {
    this.editing.set(pkg);
    this.form.reset({
      weight: pkg.weight, length: pkg.length, width: pkg.width, height: pkg.height,
      trackingNumber: pkg.trackingNumber ?? '',
    });
    this.showForm.set(true);
  }

  protected closeForm(): void {
    this.showForm.set(false);
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const request: CreateShipmentPackageRequest = {
      weight: v.weight ?? undefined,
      length: v.length ?? undefined,
      width: v.width ?? undefined,
      height: v.height ?? undefined,
      trackingNumber: v.trackingNumber.trim() || undefined,
    };
    const editing = this.editing();
    const call = editing
      ? this.shipmentService.updatePackage(this.shipmentId(), editing.id, request)
      : this.shipmentService.addPackage(this.shipmentId(), request);
    this.saving.set(true);
    call.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.load(this.shipmentId());
        this.changed.emit();
      },
      error: (err: unknown) => { this.saving.set(false); this.snackbar.errorFrom(err, 'shipments.packages.saveFailed'); },
    });
  }

  protected remove(pkg: ShipmentPackage): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('shipments.packages.removeTitle'),
        message: this.translate.instant('shipments.packages.removeMessage'),
        confirmLabel: this.translate.instant('shipments.packages.remove'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.shipmentService.removePackage(this.shipmentId(), pkg.id).subscribe({
        next: () => { this.load(this.shipmentId()); this.changed.emit(); },
        error: (err: unknown) => this.snackbar.errorFrom(err, 'shipments.packages.removeFailed'),
      });
    });
  }
}
