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
 * Carrier admin — list shipping carriers, create custom ("shadow") shippers, and enter per-carrier API
 * credentials. The secret is write-only: it's encrypted server-side and never returned, so the dialog
 * shows a "configured" badge + the non-secret client id and only ever WRITES a new secret.
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

  protected readonly showCreateDialog = signal(false);
  protected readonly showCredentialsDialog = signal(false);
  protected readonly credentialsCarrier = signal<Carrier | null>(null);

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: 'Carrier', sortable: true },
    { field: 'code', header: 'Code', sortable: true, width: '110px' },
    { field: 'integrationKind', header: 'Integration', sortable: true, width: '120px' },
    { field: 'requiresScanToShip', header: 'Scan', width: '80px', align: 'center' },
    { field: 'credentialsConfigured', header: 'Credentials', width: '130px', align: 'center' },
    { field: 'isActive', header: 'Active', width: '80px', align: 'center' },
    { field: 'actions', header: '', width: '90px', align: 'right' },
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

  protected readonly createForm = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    code: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    integrationKind: new FormControl<string>('Manual', { nonNullable: true, validators: [Validators.required] }),
    deliveryUpdateMode: new FormControl<string>('Manual', { nonNullable: true, validators: [Validators.required] }),
    integrationServiceId: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    requiresScanToShip: new FormControl<boolean>(true, { nonNullable: true }),
  });

  protected readonly credentialsForm = new FormGroup({
    clientId: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    secret: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    accountNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    environment: new FormControl<string>('sandbox', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly createViolations = FormValidationService.getViolations(this.createForm, {
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
    this.createForm.reset({
      name: '', code: '', integrationKind: 'Manual', deliveryUpdateMode: 'Manual',
      integrationServiceId: '', requiresScanToShip: true,
    });
    this.showCreateDialog.set(true);
  }

  protected closeCreate(): void {
    this.showCreateDialog.set(false);
  }

  protected saveCreate(): void {
    if (this.createForm.invalid) return;
    this.saving.set(true);
    const f = this.createForm.getRawValue();
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
        this.closeCreate();
        this.load();
      },
      error: () => this.saving.set(false),
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
