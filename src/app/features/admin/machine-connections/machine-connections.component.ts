import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MachineConnectionsService } from '../services/machine-connections.service';
import { MachineConnection, MachineTag, SaveMachineTagRequest } from '../models/machine-connection.model';
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
import { DateTimePipe } from '../../../shared/pipes/date-time.pipe';

export const OPC_SECURITY_POLICIES = ['None', 'Basic128Rsa15', 'Basic256', 'Basic256Sha256', 'Aes128_Sha256_RsaOaep', 'Aes256_Sha256_RsaPss'] as const;
export const OPC_AUTH_TYPES = ['Anonymous', 'UserName', 'Certificate'] as const;
export const OPC_DATA_TYPES = ['Boolean', 'Int16', 'Int32', 'Int64', 'Float', 'Double', 'String', 'DateTime'] as const;

type TagRow = FormGroup<{
  tagName: FormControl<string>;
  opcNodeId: FormControl<string>;
  dataType: FormControl<string>;
  unit: FormControl<string>;
  warningThresholdLow: FormControl<number | null>;
  warningThresholdHigh: FormControl<number | null>;
  alarmThresholdLow: FormControl<number | null>;
  alarmThresholdHigh: FormControl<number | null>;
}>;

/**
 * Machine connections — the OPC UA endpoints that feed machine data into OEE and predictive
 * maintenance. Each connection belongs to a work center and maps machine tags (OPC node ids) to
 * data points with warning and alarm limits. Credentials are write-only.
 */
@Component({
  selector: 'app-machine-connections',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DateTimePipe,
    PageLayoutComponent, ToolbarComponent, SpacerDirective,
    DataTableComponent, ColumnCellDirective,
    DialogComponent, InputComponent, SelectComponent, ToggleComponent,
    ValidationButtonComponent, LoadingBlockDirective,
  ],
  templateUrl: './machine-connections.component.html',
  styleUrl: './machine-connections.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MachineConnectionsComponent {
  private readonly service = inject(MachineConnectionsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly connections = signal<MachineConnection[]>([]);
  protected readonly workCenterOptions = signal<SelectOption[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly testingId = signal<number | null>(null);
  protected readonly showEditor = signal(false);
  protected readonly editing = signal<MachineConnection | null>(null);

  protected readonly securityOptions: SelectOption[] = OPC_SECURITY_POLICIES.map(p => ({ value: p, label: p }));
  protected readonly authOptions: SelectOption[] = OPC_AUTH_TYPES.map(a => ({
    value: a, label: this.translate.instant(`machineConnectionsAdmin.auth.${a}`),
  }));
  protected readonly dataTypeOptions: SelectOption[] = OPC_DATA_TYPES.map(t => ({ value: t, label: t }));

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: this.translate.instant('machineConnectionsAdmin.cols.name'), sortable: true },
    { field: 'workCenterName', header: this.translate.instant('machineConnectionsAdmin.cols.workCenter'), sortable: true, width: '160px' },
    { field: 'opcUaEndpoint', header: this.translate.instant('machineConnectionsAdmin.cols.endpoint') },
    { field: 'status', header: this.translate.instant('machineConnectionsAdmin.cols.status'), width: '130px' },
    { field: 'tagCount', header: this.translate.instant('machineConnectionsAdmin.cols.tags'), width: '80px', align: 'right' },
    { field: 'lastDataPointAt', header: this.translate.instant('machineConnectionsAdmin.cols.lastData'), type: 'date', width: '170px' },
    { field: 'actions', header: '', width: '110px', align: 'right' },
  ];

  protected readonly form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    workCenterId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    opcUaEndpoint: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500), Validators.pattern(/^opc\.tcp:\/\/.+/i)] }),
    securityPolicy: new FormControl<string>('None', { nonNullable: true }),
    authType: new FormControl<string>('Anonymous', { nonNullable: true }),
    credentials: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    pollIntervalMs: new FormControl<number>(1000, { nonNullable: true, validators: [Validators.required, Validators.min(100)] }),
    isActive: new FormControl<boolean>(true, { nonNullable: true }),
    tags: new FormArray<TagRow>([]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('machineConnectionsAdmin.fieldName'),
    workCenterId: this.translate.instant('machineConnectionsAdmin.fieldWorkCenter'),
    opcUaEndpoint: this.translate.instant('machineConnectionsAdmin.fieldEndpoint'),
    pollIntervalMs: this.translate.instant('machineConnectionsAdmin.fieldPollInterval'),
  });

  constructor() {
    this.load();
    this.service.workCenters().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (centers) => this.workCenterOptions.set(centers.map(c => ({ value: c.id, label: `${c.code} — ${c.name}` }))),
    });
  }

  protected get tags(): FormArray<TagRow> {
    return this.form.controls.tags;
  }

  protected load(): void {
    this.loading.set(true);
    this.service.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        this.connections.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected statusClass(row: MachineConnection): string {
    switch (row.status) {
      case 'Connected': return 'chip--success';
      case 'Connecting': return 'chip--info';
      case 'Error': return 'chip--error';
      default: return 'chip--muted';
    }
  }

  private tagRow(tag?: MachineTag): TagRow {
    return new FormGroup({
      tagName: new FormControl<string>(tag?.tagName ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
      opcNodeId: new FormControl<string>(tag?.opcNodeId ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
      dataType: new FormControl<string>(tag?.dataType ?? 'Double', { nonNullable: true, validators: [Validators.required] }),
      unit: new FormControl<string>(tag?.unit ?? '', { nonNullable: true, validators: [Validators.maxLength(50)] }),
      warningThresholdLow: new FormControl<number | null>(tag?.warningThresholdLow ?? null),
      warningThresholdHigh: new FormControl<number | null>(tag?.warningThresholdHigh ?? null),
      alarmThresholdLow: new FormControl<number | null>(tag?.alarmThresholdLow ?? null),
      alarmThresholdHigh: new FormControl<number | null>(tag?.alarmThresholdHigh ?? null),
    });
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.tags.clear();
    this.form.reset({
      name: '', workCenterId: null, opcUaEndpoint: '', securityPolicy: 'None', authType: 'Anonymous',
      credentials: '', pollIntervalMs: 1000, isActive: true,
    });
    this.showEditor.set(true);
  }

  protected openEdit(row: MachineConnection): void {
    this.editing.set(row);
    this.tags.clear();
    for (const tag of row.tags.filter(t => t.isActive)) this.tags.push(this.tagRow(tag));
    this.form.reset({
      name: row.name, workCenterId: row.workCenterId, opcUaEndpoint: row.opcUaEndpoint,
      securityPolicy: row.securityPolicy ?? 'None', authType: row.authType ?? 'Anonymous',
      credentials: '', pollIntervalMs: row.pollIntervalMs, isActive: row.isActive,
    });
    this.showEditor.set(true);
  }

  protected closeEditor(): void {
    this.showEditor.set(false);
    this.editing.set(null);
  }

  protected addTag(): void {
    this.tags.push(this.tagRow());
  }

  protected removeTag(index: number): void {
    this.tags.removeAt(index);
  }

  protected duplicateNodeIds(): boolean {
    const ids = this.tags.controls.map(t => t.controls.opcNodeId.value.trim()).filter(id => id.length > 0);
    return new Set(ids).size !== ids.length;
  }

  protected save(): void {
    if (this.form.invalid || this.duplicateNodeIds()) return;
    const f = this.form.getRawValue();
    const tags: SaveMachineTagRequest[] = f.tags.map(t => ({
      tagName: t.tagName.trim(),
      opcNodeId: t.opcNodeId.trim(),
      dataType: t.dataType,
      unit: t.unit.trim() || null,
      warningThresholdLow: t.warningThresholdLow,
      warningThresholdHigh: t.warningThresholdHigh,
      alarmThresholdLow: t.alarmThresholdLow,
      alarmThresholdHigh: t.alarmThresholdHigh,
    }));
    const body = {
      workCenterId: f.workCenterId!,
      name: f.name.trim(),
      opcUaEndpoint: f.opcUaEndpoint.trim(),
      securityPolicy: f.securityPolicy,
      authType: f.authType,
      credentials: f.authType === 'Anonymous' ? null : f.credentials || null,
      pollIntervalMs: f.pollIntervalMs,
      isActive: f.isActive,
      tags,
    };
    const editing = this.editing();
    this.saving.set(true);
    const request$ = editing ? this.service.update(editing.id, body) : this.service.create(body);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(editing ? 'machineConnectionsAdmin.updated' : 'machineConnectionsAdmin.created'));
        this.closeEditor();
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'machineConnectionsAdmin.saveFailed');
      },
    });
  }

  protected test(row: MachineConnection): void {
    this.testingId.set(row.id);
    this.service.test(row.id).subscribe({
      next: (result) => {
        this.testingId.set(null);
        if (result.success) this.snackbar.success(this.translate.instant('machineConnectionsAdmin.testSucceeded'));
        else this.snackbar.error(this.translate.instant('machineConnectionsAdmin.testFailed', { message: result.errorMessage ?? '' }));
        this.load();
      },
      error: (err: unknown) => {
        this.testingId.set(null);
        this.snackbar.errorFrom(err, 'machineConnectionsAdmin.testFailedGeneric');
      },
    });
  }
}
