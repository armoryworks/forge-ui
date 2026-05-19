import { ChangeDetectionStrategy, Component, inject, signal, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { AdminService } from '../../services/admin.service';
import { IntegrationSettingField, IntegrationStatus } from '../../models/integration-status.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DraftConfig } from '../../../../shared/models/draft-config.model';

export interface IntegrationConfigDialogData {
  integration: IntegrationStatus;
  showSandboxGuides: boolean;
}

@Component({
  selector: 'app-integration-config-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, SelectComponent, ToggleComponent],
  templateUrl: './integration-config-dialog.component.html',
  styleUrl: './integration-config-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationConfigDialogComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;

  private readonly matDialogRef = inject(MatDialogRef<IntegrationConfigDialogComponent>);
  private readonly adminService = inject(AdminService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  readonly data = inject<IntegrationConfigDialogData>(MAT_DIALOG_DATA);

  readonly saving = signal(false);
  readonly testing = signal(false);
  readonly testResult = signal<{ success: boolean; message: string } | null>(null);
  readonly guideExpanded = signal(false);

  readonly form: FormGroup;
  readonly fields: IntegrationSettingField[];

  /**
   * Snapshot of pre-edit values, keyed by field.key. Used to detect when
   * a mode change was actually applied so the post-save banner only fires
   * when relevant (a no-op save shouldn't claim a restart is needed).
   */
  private readonly originalValues = new Map<string, string>();

  protected readonly draftConfig: DraftConfig;

  constructor() {
    this.fields = this.data.integration.fields;
    const controls: Record<string, FormControl> = {};
    for (const field of this.fields) {
      const value = field.inputType === 'toggle'
        // Server persists Boolean settings as lowercase "true"/"false". The
        // previous strict "=== 'True'" comparison rendered every saved-ON
        // toggle as OFF on reload (silent state corruption).
        ? field.value?.toLowerCase() === 'true'
        : field.value;
      controls[field.key] = new FormControl(value);
      this.originalValues.set(field.key, field.value ?? '');
    }
    this.form = new FormGroup(controls);

    this.draftConfig = {
      entityType: 'integration-config',
      entityId: this.data.integration.provider,
      route: '/admin/integrations',
    };
  }

  /**
   * Build the SelectOption[] for an enum field. Cached per-key would be
   * nicer but enum fields are tiny (3 options for mode); recomputing
   * inline is cheap and avoids a stale-cache gotcha if the descriptor
   * changes between dialog opens.
   */
  enumOptions(field: IntegrationSettingField): SelectOption[] {
    return (field.choices ?? []).map(c => ({ value: c.value, label: c.label }));
  }

  toggleGuide(): void {
    this.guideExpanded.update(v => !v);
  }

  close(): void {
    this.matDialogRef.close(false);
  }

  save(): void {
    this.saving.set(true);
    const settings: Record<string, string> = {};
    for (const field of this.fields) {
      const val = this.form.get(field.key)?.value;
      settings[field.key] = val?.toString() ?? '';
    }

    // Detect mode changes BEFORE the request fires — comparing against the
    // pre-save snapshot. The post-save toast nudges the operator to bounce
    // the API container because Mock-vs-Real IStorageService registration
    // is fixed at process start (see IntegrationModeBootstrap). Other
    // fields hot-reload via PropagateToIOptions, but mode does not.
    const modeChanged = this.fields.some(f =>
      f.key.endsWith('.mode') && settings[f.key] !== (this.originalValues.get(f.key) ?? ''));

    this.adminService.updateIntegration(this.data.integration.provider, settings).subscribe({
      next: () => {
        this.dialogRef.clearDraft();
        this.snackbar.success(`${this.data.integration.name} ${this.translate.instant('integrationConfigDialog.settingsSaved')}`);
        if (modeChanged) {
          // Use warn (8s) so the message lingers — operator needs time to
          // notice it. Mode flip without restart = "saved successfully but
          // does absolutely nothing" which is the most confusing possible
          // UX. Better to over-communicate.
          this.snackbar.warn(
            `${this.data.integration.name} mode change requires an API restart to take effect. ` +
            `Run: docker compose restart forge-api`);
        }
        this.saving.set(false);
        this.matDialogRef.close(true);
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  test(): void {
    this.testing.set(true);
    this.testResult.set(null);

    this.adminService.testIntegration(this.data.integration.provider).subscribe({
      next: (result) => {
        this.testResult.set(result);
        this.testing.set(false);
      },
      error: () => {
        this.testResult.set({ success: false, message: this.translate.instant('integrationConfigDialog.connectionTestFailed') });
        this.testing.set(false);
      },
    });
  }

  getInputType(field: IntegrationSettingField): 'text' | 'password' | 'email' | 'number' {
    if (field.inputType === 'password') return 'password';
    if (field.inputType === 'email') return 'email';
    if (field.inputType === 'number') return 'number';
    return 'text';
  }
}
