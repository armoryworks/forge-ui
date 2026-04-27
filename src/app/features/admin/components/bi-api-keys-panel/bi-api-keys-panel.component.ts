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

import { BiApiKeyService } from '../../services/bi-api-key.service';
import {
  BiApiKey,
  CreateBiApiKeyRequest,
  CreateBiApiKeyResponse,
} from '../../models/bi-api-key.model';

/**
 * Phase 3 / WU-04 retrofit — BI API keys admin panel. Issuance + listing +
 * revocation only. Mirrors the existing admin-panel patterns
 * (data-table, dialog, OnPush + signals). No "test key" flow, no rotation,
 * no scopes UI — those are explicitly out of scope per the WU.
 */
@Component({
  selector: 'app-bi-api-keys-panel',
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
    DatepickerComponent,
    ValidationButtonComponent,
  ],
  templateUrl: './bi-api-keys-panel.component.html',
  styleUrl: './bi-api-keys-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BiApiKeysPanelComponent implements OnInit {
  private readonly biApiKeyService = inject(BiApiKeyService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

  protected readonly isLoading = signal(false);
  protected readonly keys = signal<BiApiKey[]>([]);
  protected readonly showCreateDialog = signal(false);
  protected readonly creating = signal(false);

  /**
   * Holds the issuance response so we can show the plaintext one-time. Once
   * the user dismisses the reveal dialog we drop the value — there is no
   * way to recover it from the server.
   */
  protected readonly issuedKey = signal<CreateBiApiKeyResponse | null>(null);
  protected readonly plaintextCopied = signal(false);

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: this.translate.instant('adminPanels.biApiKeys.cols.name'), sortable: true },
    { field: 'keyPrefix', header: this.translate.instant('adminPanels.biApiKeys.cols.prefix'), width: '160px' },
    { field: 'status', header: this.translate.instant('adminPanels.biApiKeys.cols.status'), width: '100px' },
    { field: 'createdAt', header: this.translate.instant('adminPanels.biApiKeys.cols.created'), sortable: true, type: 'date', width: '140px' },
    { field: 'expiresAt', header: this.translate.instant('adminPanels.biApiKeys.cols.expires'), sortable: true, type: 'date', width: '140px' },
    { field: 'lastUsedAt', header: this.translate.instant('adminPanels.biApiKeys.cols.lastUsed'), sortable: true, type: 'date', width: '160px' },
    { field: 'actions', header: '', width: '100px', align: 'right' },
  ];

  protected readonly form = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    expiresAt: new FormControl<Date | null>(null),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('adminPanels.biApiKeys.fields.name'),
    expiresAt: this.translate.instant('adminPanels.biApiKeys.fields.expiresAt'),
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.biApiKeyService.list().subscribe({
      next: (keys) => {
        this.keys.set(keys);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  protected openCreate(): void {
    this.form.reset({ name: '', expiresAt: null });
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
    const request: CreateBiApiKeyRequest = {
      name: v.name!,
      expiresAt: v.expiresAt ? toIsoDate(v.expiresAt) : null,
    };

    this.biApiKeyService.create(request).subscribe({
      next: (response) => {
        this.creating.set(false);
        this.closeCreate();
        // One-time plaintext reveal — the server can never produce it again.
        this.issuedKey.set(response);
        this.plaintextCopied.set(false);
        this.load();
        this.snackbar.success(
          this.translate.instant('adminPanels.biApiKeys.issuedSuccess', { name: response.name }),
        );
      },
      error: (err: HttpErrorResponse) => {
        this.creating.set(false);
        // Phase 3 / WU-02 envelope — surface per-field errors back on the form.
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
      this.snackbar.success(this.translate.instant('adminPanels.biApiKeys.copied'));
    });
  }

  protected revoke(key: BiApiKey): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('adminPanels.biApiKeys.revokeTitle'),
        message: this.translate.instant('adminPanels.biApiKeys.revokeMessage', {
          name: key.name,
          prefix: key.keyPrefix,
        }),
        confirmLabel: this.translate.instant('adminPanels.biApiKeys.revokeConfirm'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.biApiKeyService.revoke(key.id).subscribe({
        next: () => {
          this.snackbar.success(
            this.translate.instant('adminPanels.biApiKeys.revokedSuccess', { name: key.name }),
          );
          this.load();
        },
      });
    });
  }
}
