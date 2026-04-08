import { ChangeDetectionStrategy, Component, inject, signal, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
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
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, ToggleComponent],
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

  protected readonly draftConfig: DraftConfig;

  constructor() {
    this.fields = this.data.integration.fields;
    const controls: Record<string, FormControl> = {};
    for (const field of this.fields) {
      const value = field.inputType === 'toggle' ? field.value === 'True' : field.value;
      controls[field.key] = new FormControl(value);
    }
    this.form = new FormGroup(controls);

    this.draftConfig = {
      entityType: 'integration-config',
      entityId: this.data.integration.provider,
      route: '/admin/integrations',
    };
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

    this.adminService.updateIntegration(this.data.integration.provider, settings).subscribe({
      next: () => {
        this.dialogRef.clearDraft();
        this.snackbar.success(`${this.data.integration.name} ${this.translate.instant('integrationConfigDialog.settingsSaved')}`);
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
