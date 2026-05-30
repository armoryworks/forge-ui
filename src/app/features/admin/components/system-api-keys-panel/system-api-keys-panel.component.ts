import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';

import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { AdminService } from '../../services/admin.service';
import { SystemApiKeyService } from '../../services/system-api-key.service';
import {
  SystemApiKey,
  CreateSystemApiKeyRequest,
  CreateSystemApiKeyResponse,
} from '../../models/system-api-key.model';

/**
 * User-bound system API keys admin panel. Companion to BiApiKeysPanel:
 * same CRUD shape, distinct entity. Keys issued here authenticate AS a
 * real ApplicationUser (audit + activity rows attribute correctly), so
 * issuance requires picking a bound user.
 *
 * The "Role binding" picker is a forward-compat hook. Today it has no
 * payload effect — the key inherits the bound user's roles. When per-key
 * role-template scoping ships (docs/api-key-integrations.md §1, "per-key
 * scope grants" future-work note), the picker's data source swaps from
 * RefDataService.getRolesAsOptions() (current hardcoded role catalog) to
 * the role-template service, and submitCreate() starts populating
 * `roleTemplateId` in the request payload. Both swaps are isolated to
 * this file; the request/response model interface already carries the
 * optional field.
 */
@Component({
  selector: 'app-system-api-keys-panel',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    TranslatePipe,
    DataTableComponent,
    ColumnCellDirective,
    LoadingBlockDirective,
    DialogComponent,
    InputComponent,
    SelectComponent,
    DatepickerComponent,
    ValidationButtonComponent,
  ],
  templateUrl: './system-api-keys-panel.component.html',
  styleUrl: './system-api-keys-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SystemApiKeysPanelComponent implements OnInit {
  private readonly service = inject(SystemApiKeyService);
  private readonly adminService = inject(AdminService);
  private readonly refData = inject(ReferenceDataService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

  protected readonly isLoading = signal(false);
  protected readonly keys = signal<SystemApiKey[]>([]);
  protected readonly userOptions = signal<SelectOption[]>([]);
  protected readonly roleOptions = signal<SelectOption[]>([]);
  protected readonly showCreateDialog = signal(false);
  protected readonly creating = signal(false);

  /**
   * Issuance plaintext — shown exactly once. Once dismissed there is no
   * recovery path on the server side; the only artifact left is the prefix.
   */
  protected readonly issuedKey = signal<CreateSystemApiKeyResponse | null>(null);
  protected readonly plaintextCopied = signal(false);

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: this.translate.instant('adminPanels.systemApiKeys.cols.name'), sortable: true },
    { field: 'userEmail', header: this.translate.instant('adminPanels.systemApiKeys.cols.user'), sortable: true },
    { field: 'keyPrefix', header: this.translate.instant('adminPanels.systemApiKeys.cols.prefix'), width: '160px' },
    { field: 'status', header: this.translate.instant('adminPanels.systemApiKeys.cols.status'), width: '100px' },
    { field: 'createdAt', header: this.translate.instant('adminPanels.systemApiKeys.cols.created'), sortable: true, type: 'date', width: '140px' },
    { field: 'expiresAt', header: this.translate.instant('adminPanels.systemApiKeys.cols.expires'), sortable: true, type: 'date', width: '140px' },
    { field: 'lastUsedAt', header: this.translate.instant('adminPanels.systemApiKeys.cols.lastUsed'), sortable: true, type: 'date', width: '160px' },
    { field: 'actions', header: '', width: '100px', align: 'right' },
  ];

  /**
   * `roleBinding` is intentionally NOT in the submit payload today — see the
   * class doc. It's a first-class form field so the visual surface stays
   * stable across the eventual swap to role-template scoping; today it
   * captures admin intent but doesn't constrain the key.
   */
  protected readonly form = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    userId: new FormControl<number | null>(null, [Validators.required]),
    roleBinding: new FormControl<string | null>(null),
    expiresAt: new FormControl<Date | null>(null),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('adminPanels.systemApiKeys.fields.name'),
    userId: this.translate.instant('adminPanels.systemApiKeys.fields.user'),
    roleBinding: this.translate.instant('adminPanels.systemApiKeys.fields.role'),
    expiresAt: this.translate.instant('adminPanels.systemApiKeys.fields.expiresAt'),
  });

  ngOnInit(): void {
    this.load();
    this.loadPickers();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.service.list().subscribe({
      next: (keys) => {
        this.keys.set(keys);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  private loadPickers(): void {
    this.adminService.getUsers().subscribe((users) => {
      this.userOptions.set(users
        .filter(u => u.isActive)
        .map(u => ({
          value: u.id,
          label: `${u.lastName}, ${u.firstName} (${u.email})`,
        })));
    });
    this.refData.getRolesAsOptions().subscribe((opts) => this.roleOptions.set(opts));
  }

  protected openCreate(): void {
    this.form.reset({ name: '', userId: null, roleBinding: null, expiresAt: null });
    FormValidationService.clearServerErrors(this.form);
    this.showCreateDialog.set(true);
  }

  protected closeCreate(): void {
    this.showCreateDialog.set(false);
  }

  protected submitCreate(): void {
    if (this.form.invalid || this.creating()) return;
    this.creating.set(true);
    FormValidationService.clearServerErrors(this.form);

    const v = this.form.getRawValue();
    // Per-key role-template scoping is reserved (see class doc); we shape the
    // request without roleTemplateId today and add it here when the backend
    // is ready. `roleBinding` is captured for the admin's reference but not
    // transmitted — the underlying authz is still the bound user's roles.
    const request: CreateSystemApiKeyRequest = {
      name: v.name!,
      userId: v.userId!,
      expiresAt: v.expiresAt ? toIsoDate(v.expiresAt) : null,
    };

    this.service.create(request).subscribe({
      next: (response) => {
        this.creating.set(false);
        this.closeCreate();
        this.issuedKey.set(response);
        this.plaintextCopied.set(false);
        this.load();
        this.snackbar.success(
          this.translate.instant('adminPanels.systemApiKeys.issuedSuccess', { name: response.name }),
        );
      },
      error: (err: HttpErrorResponse) => {
        this.creating.set(false);
        FormValidationService.applyServerError(this.form, err);
      },
    });
  }

  protected dismissIssuedKey(): void {
    this.issuedKey.set(null);
    this.plaintextCopied.set(false);
  }

  protected copyPlaintext(): void {
    const key = this.issuedKey();
    if (!key) return;
    navigator.clipboard.writeText(key.plaintextKey).then(() => {
      this.plaintextCopied.set(true);
      this.snackbar.success(this.translate.instant('adminPanels.systemApiKeys.copied'));
    });
  }

  protected revoke(key: SystemApiKey): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('adminPanels.systemApiKeys.revokeTitle'),
        message: this.translate.instant('adminPanels.systemApiKeys.revokeMessage', {
          name: key.name,
          prefix: key.keyPrefix,
          user: key.userEmail ?? '',
        }),
        confirmLabel: this.translate.instant('adminPanels.systemApiKeys.revokeConfirm'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.revoke(key.id).subscribe({
        next: () => {
          this.snackbar.success(
            this.translate.instant('adminPanels.systemApiKeys.revokedSuccess', { name: key.name }),
          );
          this.load();
        },
      });
    });
  }
}
