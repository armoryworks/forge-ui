import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
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
import { isCapabilityDisabledError } from '../../../../shared/errors/capability-disabled.error';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';

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
 * The "Role-template binding" picker scopes the key's effective role set
 * at auth time to the intersection of (bound user's roles) ∩ (template's
 * IncludedRoleNames) — the template can only narrow, never expand. When
 * left null, the key inherits the user's full grant set. Picker options
 * come from `AdminService.getRoleTemplates()`; selecting "None" disables
 * scoping.
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
    MatTooltipModule,
  ],
  templateUrl: './system-api-keys-panel.component.html',
  styleUrl: './system-api-keys-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SystemApiKeysPanelComponent implements OnInit {
  private readonly service = inject(SystemApiKeyService);
  private readonly adminService = inject(AdminService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

  protected readonly isLoading = signal(false);
  protected readonly keys = signal<SystemApiKey[]>([]);
  protected readonly userOptions = signal<SelectOption[]>([]);
  protected readonly roleTemplateOptions = signal<SelectOption[]>([]);
  protected readonly showCreateDialog = signal(false);
  protected readonly creating = signal(false);

  /**
   * Server-rejected capability state — mirrors the bi-api-keys-panel fix
   * (2026-05-31). Both endpoints sit behind CAP-IDEN-AUTH-API-KEYS which
   * is IsDefaultOn=false, so on a fresh install the silent capability-
   * disabled 403 has to be surfaced explicitly or the panel reads as
   * broken.
   */
  protected readonly capabilityDisabled = signal<string | null>(null);

  /**
   * Issuance plaintext — shown exactly once. Once dismissed there is no
   * recovery path on the server side; the only artifact left is the prefix.
   */
  protected readonly issuedKey = signal<CreateSystemApiKeyResponse | null>(null);
  protected readonly plaintextCopied = signal(false);

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: this.translate.instant('adminPanels.systemApiKeys.cols.name'), sortable: true },
    { field: 'userEmail', header: this.translate.instant('adminPanels.systemApiKeys.cols.user'), sortable: true },
    { field: 'roleTemplateName', header: this.translate.instant('adminPanels.systemApiKeys.cols.roleTemplate'), sortable: true, width: '180px' },
    { field: 'keyPrefix', header: this.translate.instant('adminPanels.systemApiKeys.cols.prefix'), width: '160px' },
    { field: 'status', header: this.translate.instant('adminPanels.systemApiKeys.cols.status'), width: '100px' },
    { field: 'createdAt', header: this.translate.instant('adminPanels.systemApiKeys.cols.created'), sortable: true, type: 'date', width: '140px' },
    { field: 'expiresAt', header: this.translate.instant('adminPanels.systemApiKeys.cols.expires'), sortable: true, type: 'date', width: '140px' },
    { field: 'lastUsedAt', header: this.translate.instant('adminPanels.systemApiKeys.cols.lastUsed'), sortable: true, type: 'date', width: '160px' },
    { field: 'actions', header: '', width: '100px', align: 'right' },
  ];

  protected readonly form = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    userId: new FormControl<number | null>(null, [Validators.required]),
    roleTemplateId: new FormControl<number | null>(null),
    expiresAt: new FormControl<Date | null>(null),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('adminPanels.systemApiKeys.fields.name'),
    userId: this.translate.instant('adminPanels.systemApiKeys.fields.user'),
    roleTemplateId: this.translate.instant('adminPanels.systemApiKeys.fields.roleTemplate'),
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
        this.capabilityDisabled.set(null);
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        this.isLoading.set(false);
        if (isCapabilityDisabledError(err)) {
          this.capabilityDisabled.set(err.message);
        }
      },
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
    // Active templates only (deactivated ones can't be assigned). Prepend a
    // "None — inherit user's roles" entry so admins can explicitly opt out
    // of scoping rather than relying on "leave blank".
    this.adminService.getRoleTemplates(false).subscribe((templates) => {
      const noneLabel = this.translate.instant('adminPanels.systemApiKeys.roleTemplateNone');
      this.roleTemplateOptions.set([
        { value: null, label: noneLabel },
        ...templates.map((t) => ({
          value: t.id,
          label: `${t.name} (${t.includedRoleNames.join(', ')})`,
        })),
      ]);
    });
  }

  protected openCreate(): void {
    this.form.reset({ name: '', userId: null, roleTemplateId: null, expiresAt: null });
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
    const request: CreateSystemApiKeyRequest = {
      name: v.name!,
      userId: v.userId!,
      roleTemplateId: v.roleTemplateId ?? null,
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
      error: (err: HttpErrorResponse | unknown) => {
        this.creating.set(false);
        if (isCapabilityDisabledError(err)) {
          this.capabilityDisabled.set(err.message);
          this.closeCreate();
          this.snackbar.error(
            this.translate.instant('adminPanels.systemApiKeys.capabilityDisabled'),
          );
          return;
        }
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
