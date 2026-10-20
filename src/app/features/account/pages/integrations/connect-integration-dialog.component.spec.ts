import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { UserIntegrationService } from '../../services/user-integration.service';
import { IntegrationProviderInfo } from '../../models/user-integration.model';
import { ConnectIntegrationDialogComponent } from './connect-integration-dialog.component';

describe('ConnectIntegrationDialogComponent', () => {
  const integrations = { create: vi.fn(() => of({})) };

  function open(authType: string): { form: FormGroup; isSingleSecret: boolean; save(): void } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { provider: { providerId: 'p', category: 'calendar', displayName: 'P', authType, description: '', icon: 'x' } as IntegrationProviderInfo } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: UserIntegrationService, useValue: integrations },
        { provide: SnackbarService, useValue: { success: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    return TestBed.runInInjectionContext(() => new ConnectIntegrationDialogComponent()) as unknown as { form: FormGroup; isSingleSecret: boolean; save(): void };
  }

  beforeEach(() => vi.clearAllMocks());

  it('lets a provider without credentials connect with nothing filled in', () => {
    const dialog = open('none');

    expect(dialog.form.valid).toBe(true);
    dialog.save();
    expect(integrations.create).toHaveBeenCalledWith(expect.objectContaining({ credentialsJson: '{}' }));
  });

  it('still requires the secret for providers that need one', () => {
    const dialog = open('oauth2');

    expect(dialog.form.valid).toBe(false);
    expect(dialog.isSingleSecret).toBe(true);
  });

  it('builds basic credentials from separate username and password fields', () => {
    const dialog = open('basic');

    expect(dialog.form.valid).toBe(false);
    dialog.form.patchValue({ username: 'me', password: 's3cret' });
    expect(dialog.form.valid).toBe(true);
    dialog.save();
    expect(integrations.create).toHaveBeenCalledWith(expect.objectContaining({
      credentialsJson: JSON.stringify({ username: 'me', password: 's3cret' }),
    }));
  });

  it('builds access-key credentials and leaves out a blank endpoint', () => {
    const dialog = open('access_key');

    dialog.form.patchValue({ accessKey: 'AK', secretKey: 'SK' });
    expect(dialog.form.valid).toBe(true);
    dialog.save();
    expect(integrations.create).toHaveBeenCalledWith(expect.objectContaining({
      credentialsJson: JSON.stringify({ accessKey: 'AK', secretKey: 'SK' }),
    }));
  });
});
