import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { AdminService } from '../../services/admin.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { IntegrationStatus } from '../../models/integration-status.model';
import { IntegrationConfigDialogComponent } from './integration-config-dialog.component';

const smtp: IntegrationStatus = {
  provider: 'smtp',
  name: 'SMTP',
  description: '',
  icon: 'mail',
  isConfigured: false,
  category: 'service',
  sandboxSteps: null,
  sandboxUrl: null,
  logoUrl: null,
  fields: [
    { key: 'smtp.mode', label: 'Mode', value: 'Mock', isSensitive: false, isRequired: false, inputType: 'enum', choices: [{ value: 'Real', label: 'Real' }] },
    { key: 'smtp.host', label: 'Host', value: '', isSensitive: false, isRequired: true, inputType: 'text' },
    { key: 'smtp.use-ssl', label: 'SSL', value: 'false', isSensitive: false, isRequired: false, inputType: 'toggle' },
  ],
};

const docuseal: IntegrationStatus = {
  ...smtp,
  provider: 'docuseal',
  name: 'DocuSeal',
  fields: [
    { key: 'docuseal.api-key', label: 'API Key', value: '••••••••', isSensitive: true, isRequired: false, inputType: 'password' },
    { key: 'docuseal.webhook-secret', label: 'Webhook Secret', value: '', isSensitive: true, isRequired: false, inputType: 'password' },
  ],
};

function setup(integration: IntegrationStatus = smtp) {
  const adminService = { updateIntegration: vi.fn().mockReturnValue(of(undefined)), testIntegration: vi.fn() };
  const snackbar = { success: vi.fn(), warn: vi.fn(), errorFrom: vi.fn() };
  const matDialogRef = { close: vi.fn() };
  TestBed.configureTestingModule({
    imports: [IntegrationConfigDialogComponent, TranslateModule.forRoot()],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MAT_DIALOG_DATA, useValue: { integration, showSandboxGuides: false } },
      { provide: MatDialogRef, useValue: matDialogRef },
      { provide: AdminService, useValue: adminService },
      { provide: SnackbarService, useValue: snackbar },
    ],
  });
  const component = TestBed.createComponent(IntegrationConfigDialogComponent).componentInstance;
  Object.assign(component, { dialogRef: { clearDraft: vi.fn() } });
  return { component, adminService, snackbar, matDialogRef };
}

describe('IntegrationConfigDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('names its form controls without dots', () => {
    const { component } = setup();

    expect(Object.keys(component.form.controls).some(name => name.includes('.'))).toBe(false);
  });

  it('saves the values the operator entered under the setting keys', () => {
    const { component, adminService } = setup();
    for (const field of component.fields) {
      const control = component.form.controls[component.controlName(field)];
      if (field.key === 'smtp.mode') control.setValue('Real');
      if (field.key === 'smtp.host') control.setValue('mail.example.test');
      if (field.key === 'smtp.use-ssl') control.setValue(true);
    }

    component.save();

    expect(adminService.updateIntegration).toHaveBeenCalledWith('smtp', {
      'smtp.mode': 'Real',
      'smtp.host': 'mail.example.test',
      'smtp.use-ssl': 'true',
    });
  });

  it('warns about a restart only when the mode changed', () => {
    const { component, snackbar } = setup();
    component.form.controls[component.controlName(smtp.fields[1])].setValue('mail.example.test');

    component.save();

    expect(snackbar.warn).not.toHaveBeenCalled();
  });

  it('keeps secrets write-only: shows set or not set, starts empty and only sends a newly typed secret', () => {
    const { component, adminService } = setup(docuseal);
    const [apiKey, webhookSecret] = component.fields;

    expect(component.isSecretSet(apiKey)).toBe(true);
    expect(component.isSecretSet(webhookSecret)).toBe(false);
    expect(component.form.controls[component.controlName(apiKey)].value).toBe('');

    component.form.controls[component.controlName(webhookSecret)].setValue('whsec_from_docuseal');
    component.save();

    expect(adminService.updateIntegration).toHaveBeenCalledWith('docuseal', { 'docuseal.webhook-secret': 'whsec_from_docuseal' });
  });
});
