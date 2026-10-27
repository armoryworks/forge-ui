import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CloudStorageService } from '../services/cloud-storage.service';
import {
  CloudStorageProvider,
  CloudStorageProviderMode,
  CloudStorageProviderType,
  FolderMapEntry,
} from '../models/cloud-storage.model';
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
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { DateTimePipe } from '../../../shared/pipes/date-time.pipe';

export const FOLDER_MAP_ENTITY_TYPES = ['Customer', 'Job', 'Deliverable'] as const;
export const FOLDER_MAP_TOKENS = ['Customer', 'Project', 'Job', 'Year', 'Month', 'Quarter', 'EngagementType'] as const;

type FolderMapRow = FormGroup<{
  entityType: FormControl<string>;
  pathTemplate: FormControl<string>;
  subfolders: FormControl<string>;
  autoCreateOnEntityCreate: FormControl<boolean>;
}>;

/**
 * Cloud storage — the install's storage providers (Google Drive, OneDrive, Dropbox) and the folder
 * map that decides which folder a new customer, job or deliverable gets. Provider tokens are
 * write-only: they are encrypted on the server and only a "configured" flag comes back.
 */
@Component({
  selector: 'app-cloud-storage',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DateTimePipe,
    PageLayoutComponent, ToolbarComponent, SpacerDirective,
    DataTableComponent, ColumnCellDirective,
    DialogComponent, InputComponent, SelectComponent, ToggleComponent,
    ValidationButtonComponent, LoadingBlockDirective,
  ],
  templateUrl: './cloud-storage.component.html',
  styleUrl: './cloud-storage.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CloudStorageComponent {
  private readonly service = inject(CloudStorageService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly providers = signal<CloudStorageProvider[]>([]);
  protected readonly providerTypes = signal<CloudStorageProviderType[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly savingMap = signal(false);
  protected readonly testingId = signal<number | null>(null);
  protected readonly showEditor = signal(false);
  protected readonly editing = signal<CloudStorageProvider | null>(null);

  protected readonly tokenHint = FOLDER_MAP_TOKENS.map(t => `{${t}}`).join(' ');

  protected readonly providerOptions = computed<SelectOption[]>(() => this.providerTypes()
    .filter(t => t.capabilityEnabled)
    .map(t => ({ value: t.code, label: this.providerLabel(t.code) })));

  protected readonly modeOptions: SelectOption[] = [
    { value: 'PerUser', label: this.translate.instant('cloudStorageAdmin.modePerUser') },
    { value: 'ServiceAccount', label: this.translate.instant('cloudStorageAdmin.modeServiceAccount') },
  ];

  protected readonly entityTypeOptions: SelectOption[] = FOLDER_MAP_ENTITY_TYPES.map(t => ({
    value: t, label: this.translate.instant(`cloudStorageAdmin.entityTypes.${t}`),
  }));

  protected readonly columns: ColumnDef[] = [
    { field: 'providerCode', header: this.translate.instant('cloudStorageAdmin.cols.provider'), sortable: true },
    { field: 'mode', header: this.translate.instant('cloudStorageAdmin.cols.mode'), width: '150px' },
    { field: 'rootFolderId', header: this.translate.instant('cloudStorageAdmin.cols.rootFolder') },
    { field: 'credentialsConfigured', header: this.translate.instant('cloudStorageAdmin.cols.credentials'), width: '130px', align: 'center' },
    { field: 'lastConnectedAt', header: this.translate.instant('cloudStorageAdmin.cols.lastConnected'), type: 'date', width: '170px' },
    { field: 'linkedRecordCount', header: this.translate.instant('cloudStorageAdmin.cols.linked'), width: '90px', align: 'right' },
    { field: 'isActive', header: this.translate.instant('cloudStorageAdmin.cols.status'), width: '100px', align: 'center' },
    { field: 'actions', header: '', width: '150px', align: 'right' },
  ];

  protected readonly form = new FormGroup({
    providerCode: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    mode: new FormControl<CloudStorageProviderMode>('PerUser', { nonNullable: true, validators: [Validators.required] }),
    rootFolderId: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    serviceAccountId: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    accessToken: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    refreshToken: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    isActive: new FormControl<boolean>(true, { nonNullable: true }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    providerCode: this.translate.instant('cloudStorageAdmin.fieldProvider'),
    mode: this.translate.instant('cloudStorageAdmin.fieldMode'),
  });

  protected readonly folderMap = new FormArray<FolderMapRow>([]);

  constructor() {
    this.load();
    this.service.providerTypes().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (types) => this.providerTypes.set(types),
    });
    this.service.folderMap().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (entries) => this.setFolderMap(entries),
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.service.providers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        this.providers.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected providerLabel(code: string): string {
    return this.translate.instant(`cloudStorageAdmin.providers.${code}`);
  }

  protected needsTokens(): boolean {
    return this.form.controls.mode.value === 'ServiceAccount' && this.form.controls.providerCode.value !== 'mock';
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({
      providerCode: this.providerOptions()[0]?.value as string ?? '', mode: 'PerUser', rootFolderId: '',
      serviceAccountId: '', accessToken: '', refreshToken: '', isActive: true,
    });
    this.form.controls.providerCode.enable();
    this.showEditor.set(true);
  }

  protected openEdit(row: CloudStorageProvider): void {
    this.editing.set(row);
    this.form.reset({
      providerCode: row.providerCode, mode: row.mode, rootFolderId: row.rootFolderId ?? '',
      serviceAccountId: row.serviceAccountId ?? '', accessToken: '', refreshToken: '', isActive: row.isActive,
    });
    this.form.controls.providerCode.disable();
    this.showEditor.set(true);
  }

  protected closeEditor(): void {
    this.showEditor.set(false);
    this.editing.set(null);
  }

  protected canSave(): boolean {
    if (this.form.invalid) return false;
    if (this.editing() || !this.needsTokens()) return true;
    const f = this.form.getRawValue();
    return f.accessToken.length > 0 && f.refreshToken.length > 0;
  }

  protected save(): void {
    if (!this.canSave()) return;
    const f = this.form.getRawValue();
    const editing = this.editing();
    const body = {
      mode: f.mode,
      rootFolderId: f.rootFolderId.trim() || null,
      serviceAccountId: f.serviceAccountId.trim() || null,
      accessToken: f.accessToken || null,
      refreshToken: f.refreshToken || null,
      tokenExpiresAt: null,
      isActive: f.isActive,
    };
    this.saving.set(true);
    const request$ = editing
      ? this.service.update(editing.id, body)
      : this.service.create({ ...body, providerCode: f.providerCode });
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(editing ? 'cloudStorageAdmin.updated' : 'cloudStorageAdmin.created'));
        this.closeEditor();
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'cloudStorageAdmin.saveFailed');
      },
    });
  }

  protected test(row: CloudStorageProvider): void {
    this.testingId.set(row.id);
    this.service.test(row.id).subscribe({
      next: (result) => {
        this.testingId.set(null);
        if (result.success) this.snackbar.success(this.translate.instant('cloudStorageAdmin.testSucceeded', { message: result.message }));
        else this.snackbar.error(this.translate.instant('cloudStorageAdmin.testFailed', { message: result.message }));
        this.load();
      },
      error: (err: unknown) => {
        this.testingId.set(null);
        this.snackbar.errorFrom(err, 'cloudStorageAdmin.testFailedGeneric');
      },
    });
  }

  protected confirmDelete(row: CloudStorageProvider): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('cloudStorageAdmin.deleteTitle'),
        message: this.translate.instant('cloudStorageAdmin.deleteConfirm', { provider: this.providerLabel(row.providerCode) }),
        confirmLabel: this.translate.instant('common.delete'),
        cancelLabel: this.translate.instant('common.cancel'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.delete(row.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('cloudStorageAdmin.deleted'));
          this.load();
        },
        error: (err: unknown) => this.snackbar.errorFrom(err, 'cloudStorageAdmin.deleteFailed'),
      });
    });
  }

  private newRow(entry?: FolderMapEntry): FolderMapRow {
    return new FormGroup({
      entityType: new FormControl<string>(entry?.entityType ?? this.unusedEntityType(), { nonNullable: true, validators: [Validators.required] }),
      pathTemplate: new FormControl<string>(entry?.pathTemplate ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
      subfolders: new FormControl<string>((entry?.subfolderNames ?? []).join(', '), { nonNullable: true }),
      autoCreateOnEntityCreate: new FormControl<boolean>(entry?.autoCreateOnEntityCreate ?? true, { nonNullable: true }),
    });
  }

  private unusedEntityType(): string {
    const used = new Set(this.folderMap.controls.map(c => c.controls.entityType.value));
    return FOLDER_MAP_ENTITY_TYPES.find(t => !used.has(t)) ?? FOLDER_MAP_ENTITY_TYPES[0];
  }

  private setFolderMap(entries: FolderMapEntry[]): void {
    this.folderMap.clear();
    for (const entry of entries) this.folderMap.push(this.newRow(entry));
    this.folderMap.markAsPristine();
  }

  protected addFolderMapRow(): void {
    this.folderMap.push(this.newRow());
    this.folderMap.markAsDirty();
  }

  protected removeFolderMapRow(index: number): void {
    this.folderMap.removeAt(index);
    this.folderMap.markAsDirty();
  }

  protected duplicateEntityTypes(): boolean {
    const types = this.folderMap.controls.map(c => c.controls.entityType.value);
    return new Set(types).size !== types.length;
  }

  protected folderMapPayload(): FolderMapEntry[] {
    return this.folderMap.controls.map(c => {
      const v = c.getRawValue();
      return {
        entityType: v.entityType,
        pathTemplate: v.pathTemplate.trim(),
        subfolderNames: v.subfolders.split(',').map(s => s.trim()).filter(s => s.length > 0),
        autoCreateOnEntityCreate: v.autoCreateOnEntityCreate,
      };
    });
  }

  protected saveFolderMap(): void {
    if (this.folderMap.invalid || this.duplicateEntityTypes()) return;
    this.savingMap.set(true);
    this.service.saveFolderMap(this.folderMapPayload()).subscribe({
      next: (saved) => {
        this.savingMap.set(false);
        this.setFolderMap(saved);
        this.snackbar.success(this.translate.instant('cloudStorageAdmin.folderMapSaved'));
      },
      error: (err: unknown) => {
        this.savingMap.set(false);
        this.snackbar.errorFrom(err, 'cloudStorageAdmin.folderMapFailed');
      },
    });
  }
}
