import { TestBed } from '@angular/core/testing';

import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { BankingSettingsPanelComponent } from './banking-settings-panel.component';
import { AdminSettingsService } from '../../settings/services/admin-settings.service';
import { SettingsCatalogEntry } from '../../settings/models/setting-entry.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

const entry = (key: string, dataType: SettingsCatalogEntry['dataType'], value: string | null, extra: Partial<SettingsCatalogEntry> = {}): SettingsCatalogEntry => ({
  key, group: 'Banking', displayName: key, description: null, dataType, defaultValue: null,
  isSecret: false, isRequired: false, sortOrder: 0, value, hasValue: value !== null, choices: null, ...extra,
});

const ENTRIES: SettingsCatalogEntry[] = [
  entry('banking.wire.manual-attestation', 'Boolean', 'false'),
  entry('banking.nacha.channel', 'String', 'manual'),
  entry('banking.sftp.host', 'String', 'sftp.bank.example'),
  entry('banking.sftp.port', 'Integer', '22'),
  entry('banking.sftp.password', 'Secret', '••••••••', { isSecret: true, hasValue: true }),
  entry('banking.sftp.host-key-fingerprint', 'String', null),
];

interface PanelInternals {
  sections: () => { id: string; rows: { key: string; kind: string; secretStored: boolean }[] }[];
  control: (key: string) => { value: unknown; setValue: (v: unknown) => void; markAsDirty: () => void };
  save: () => void;
}

describe('BankingSettingsPanelComponent', () => {
  let updateSetting: ReturnType<typeof vi.fn>;

  function create(): PanelInternals {
    updateSetting = vi.fn().mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      providers: [
        { provide: AdminSettingsService, useValue: { getGroup: vi.fn().mockReturnValue(of(ENTRIES)), updateSetting } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    return TestBed.runInInjectionContext(() => new BankingSettingsPanelComponent()) as unknown as PanelInternals;
  }

  function edit(panel: PanelInternals, key: string, value: unknown): void {
    const control = panel.control(key);
    control.setValue(value);
    control.markAsDirty();
  }

  it('renders the wire attestation toggle and the SFTP host key pin from the Banking group', () => {
    const panel = create();
    const rows = panel.sections().flatMap(s => s.rows);

    expect(rows.find(r => r.key === 'banking.wire.manual-attestation')?.kind).toBe('toggle');
    expect(rows.find(r => r.key === 'banking.nacha.channel')?.kind).toBe('select');
    expect(rows.find(r => r.key === 'banking.sftp.port')?.kind).toBe('number');
    expect(rows.find(r => r.key === 'banking.sftp.host-key-fingerprint')?.kind).toBe('text');
    expect(panel.control('banking.sftp.host').value).toBe('sftp.bank.example');
  });

  it('never prefills a secret and marks a stored one', () => {
    const panel = create();
    const secret = panel.sections().flatMap(s => s.rows).find(r => r.key === 'banking.sftp.password');

    expect(secret?.kind).toBe('secret');
    expect(secret?.secretStored).toBe(true);
    expect(panel.control('banking.sftp.password').value).toBe('');
  });

  it('saves only the edited settings, booleans as text, and skips a blank secret', () => {
    const panel = create();
    edit(panel, 'banking.wire.manual-attestation', true);
    edit(panel, 'banking.sftp.host-key-fingerprint', '  SHA256:ohD8VZEXGWo6Ez8GSEJQ9WpafgLFsOfLOtGGQCQo6Og ');
    edit(panel, 'banking.sftp.password', '');

    panel.save();

    expect(updateSetting.mock.calls).toEqual([
      ['banking.wire.manual-attestation', 'true'],
      ['banking.sftp.host-key-fingerprint', 'SHA256:ohD8VZEXGWo6Ez8GSEJQ9WpafgLFsOfLOtGGQCQo6Og'],
    ]);
  });

  it('saves a number field, which the input emits as a number, as text', () => {
    const panel = create();
    edit(panel, 'banking.sftp.port', 2222);

    panel.save();

    expect(updateSetting).toHaveBeenCalledWith('banking.sftp.port', '2222');
  });

  it('clears a plain setting when it is emptied', () => {
    const panel = create();
    edit(panel, 'banking.sftp.host', '');

    panel.save();

    expect(updateSetting).toHaveBeenCalledWith('banking.sftp.host', null);
  });
});
