import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CarrierService } from '../services/carrier.service';
import { Carrier } from '../models/carrier.model';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { ToolbarComponent } from '../../../shared/components/toolbar/toolbar.component';
import { SpacerDirective } from '../../../shared/directives/spacer.directive';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';

/**
 * Carrier admin — list shipping carriers, create custom ("shadow") shippers, edit any carrier's settings
 * (delivery updates, scan-to-ship, active), and enter per-carrier API credentials. The secret is
 * write-only: it's encrypted server-side and never returned, so the dialog shows a "configured" badge +
 * the non-secret client id and only ever WRITES a new secret.
 */
@Component({
  selector: 'app-carriers',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    PageLayoutComponent, ToolbarComponent, SpacerDirective,
    DataTableComponent, ColumnCellDirective,
    DialogComponent, InputComponent, SelectComponent, ToggleComponent,
    ValidationButtonComponent, LoadingBlockDirective,
  ],
  templateUrl: './carriers.component.html',
  styleUrl: './carriers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarriersComponent {
  private readonly service = inject(CarrierService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly carriers = signal<Carrier[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);

  protected readonly showCarrierDialog = signal(false);
  protected readonly editingCarrier = signal<Carrier | null>(null);
  protected readonly showCredentialsDialog = signal(false);
  protected readonly credentialsCarrier = signal<Carrier | null>(null);
  protected readonly testingId = signal<number | null>(null);

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: 'columns.carrier', sortable: true },
    { field: 'code', header: 'admin.carriers.fieldCode', sortable: true, width: '110px' },
    { field: 'integrationKind', header: 'admin.carriers.fieldKind', sortable: true, width: '120px' },
    { field: 'requiresScanToShip', header: 'columns.scan', width: '80px', align: 'center' },
    { field: 'credentialsConfigured', header: 'columns.credentials', width: '130px', align: 'center' },
    { field: 'isActive', header: 'common.active', width: '80px', align: 'center' },
    { field: 'actions', header: '', width: '160px', align: 'right' },
  ];

  protected readonly integrationKindOptions: SelectOption[] = [
    { value: 'Manual', label: this.translate.instant('admin.carriers.kindManual') },
    { value: 'Api', label: this.translate.instant('admin.carriers.kindApi') },
  ];

  protected readonly deliveryModeOptions: SelectOption[] = [
    { value: 'Manual', label: this.translate.instant('admin.carriers.deliveryManual') },
    { value: 'Poll', label: this.translate.instant('admin.carriers.deliveryPoll') },
    { value: 'Webhook', label: this.translate.instant('admin.carriers.deliveryWebhook') },
  ];

  protected readonly environmentOptions: SelectOption[] = [
    { value: 'sandbox', label: this.translate.instant('admin.carriers.envSandbox') },
    { value: 'production', label: this.translate.instant('admin.carriers.envProduction') },
  ];

  protected readonly carrierForm = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    code: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    integrationKind: new FormControl<string>('Manual', { nonNullable: true, validators: [Validators.required] }),
    deliveryUpdateMode: new FormControl<string>('Manual', { nonNullable: true, validators: [Validators.required] }),
    integrationServiceId: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    requiresScanToShip: new FormControl<boolean>(true, { nonNullable: true }),
    isActive: new FormControl<boolean>(true, { nonNullable: true }),
  });

  protected readonly credentialsForm = new FormGroup({
    clientId: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    secret: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    accountNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    environment: new FormControl<string>('sandbox', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly carrierViolations = FormValidationService.getViolations(this.carrierForm, {
    name: this.translate.instant('admin.carriers.fieldName'),
    integrationKind: this.translate.instant('admin.carriers.fieldKind'),
  });

  protected readonly credentialsViolations = FormValidationService.getViolations(this.credentialsForm, {
    clientId: this.translate.instant('admin.carriers.fieldClientId'),
    secret: this.translate.instant('admin.carriers.fieldSecret'),
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.list(false).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        this.carriers.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openCreate(): void {
    this.editingCarrier.set(null);
    this.carrierForm.reset({
      name: '', code: '', integrationKind: 'Manual', deliveryUpdateMode: 'Manual',
      integrationServiceId: '', requiresScanToShip: true, isActive: true,
    });
    this.showCarrierDialog.set(true);
  }

  protected openEdit(row: Carrier): void {
    this.editingCarrier.set(row);
    this.carrierForm.reset({
      name: row.name,
      code: row.code ?? '',
      integrationKind: row.integrationKind,
      deliveryUpdateMode: row.deliveryUpdateMode,
      integrationServiceId: row.integrationServiceId ?? '',
      requiresScanToShip: row.requiresScanToShip,
      isActive: row.isActive,
    });
    this.showCarrierDialog.set(true);
  }

  protected closeCarrierDialog(): void {
    this.showCarrierDialog.set(false);
    this.editingCarrier.set(null);
  }

  protected saveCarrier(): void {
    if (this.carrierForm.invalid) return;
    const editing = this.editingCarrier();
    if (editing) {
      this.saveEdit(editing);
      return;
    }
    this.saving.set(true);
    const f = this.carrierForm.getRawValue();
    this.service.create({
      name: f.name.trim(),
      code: f.code.trim() || null,
      integrationKind: f.integrationKind,
      deliveryUpdateMode: f.deliveryUpdateMode,
      integrationServiceId: f.integrationServiceId.trim() || null,
      requiresScanToShip: f.requiresScanToShip,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('admin.carriers.created'));
        this.closeCarrierDialog();
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  private saveEdit(carrier: Carrier): void {
    this.saving.set(true);
    const f = this.carrierForm.getRawValue();
    this.service.update(carrier.id, {
      name: f.name.trim(),
      code: f.code.trim(),
      integrationKind: f.integrationKind,
      deliveryUpdateMode: f.deliveryUpdateMode,
      integrationServiceId: f.integrationServiceId.trim(),
      requiresScanToShip: f.requiresScanToShip,
      isActive: f.isActive,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('admin.carriers.updated'));
        this.closeCarrierDialog();
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'admin.carriers.updateFailed');
      },
    });
  }

  protected openCredentials(row: Carrier): void {
    this.credentialsCarrier.set(row);
    // Pre-fill the (non-secret) client id + environment; the secret is always re-entered.
    this.credentialsForm.reset({
      clientId: row.credentialClientId ?? '',
      secret: '',
      accountNumber: '',
      environment: row.credentialEnvironment ?? 'sandbox',
    });
    this.showCredentialsDialog.set(true);
  }

  protected closeCredentials(): void {
    this.showCredentialsDialog.set(false);
    this.credentialsCarrier.set(null);
  }

  protected testCarrier(row: Carrier): void {
    this.testingId.set(row.id);
    this.service.test(row.id).subscribe({
      next: (r) => {
        this.testingId.set(null);
        if (r.success) this.snackbar.success(r.message);
        else this.snackbar.error(r.message);
      },
      error: () => this.testingId.set(null),
    });
  }

  protected saveCredentials(): void {
    const carrier = this.credentialsCarrier();
    if (carrier === null || this.credentialsForm.invalid) return;
    this.saving.set(true);
    const f = this.credentialsForm.getRawValue();
    this.service.updateCredentials(carrier.id, {
      clientId: f.clientId.trim(),
      secret: f.secret,
      accountNumber: f.accountNumber.trim() || null,
      environment: f.environment,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('admin.carriers.credentialsSaved'));
        this.closeCredentials();
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
