import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { PresetCustomComponent } from './preset-custom.component';
import { PresetService } from '../../../../shared/services/preset.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { CapabilityInstallStateService } from '../../../../shared/services/capability-install-state.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { PresetCapabilityRow, PresetCustomOverride, PresetCustomPreview } from '../../../../shared/models/preset.model';

interface CustomInternals {
  ngOnInit(): void;
  groupedCapabilities: { (): { area: string; rows: (PresetCapabilityRow & { overridden: boolean })[] }[] };
  toggle(row: PresetCapabilityRow): void;
}

const install = [
  { code: 'CAP-A', enabled: true, isDefaultOn: true },
  { code: 'CAP-B', enabled: true, isDefaultOn: false },
  { code: 'CAP-C', enabled: false, isDefaultOn: true },
];

function previewFor(overrides: PresetCustomOverride[]): PresetCustomPreview {
  const map = new Map(overrides.map(o => [o.code, o.enabled]));
  const capabilities = install.map(c => ({
    code: c.code, name: c.code, area: 'X', description: '', defaultOn: c.isDefaultOn,
    inPreset: map.get(c.code) ?? c.isDefaultOn,
  }));
  return {
    capabilityCount: capabilities.filter(c => c.inPreset).length,
    capabilities,
    deltaVsCurrentInstall: [],
    valid: true,
    violations: [],
  };
}

describe('PresetCustomComponent', () => {
  let previewCustom: ReturnType<typeof vi.fn>;
  let component: CustomInternals;

  beforeEach(() => {
    TestBed.resetTestingModule();
    previewCustom = vi.fn((overrides: PresetCustomOverride[]) => of(previewFor(overrides)));
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: PresetService, useValue: { previewCustom, previewing: signal(false) } },
        { provide: CapabilityService, useValue: { capabilities: signal(install), load: () => of(undefined) } },
        { provide: CapabilityInstallStateService, useValue: { dismiss: vi.fn() } },
        { provide: SnackbarService, useValue: { errorFrom: vi.fn() } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new PresetCustomComponent()) as unknown as CustomInternals;
  });

  it('starts from the current install, so an untouched builder proposes exactly the install state', () => {
    component.ngOnInit();

    const sent = previewCustom.mock.calls[0][0] as PresetCustomOverride[];
    expect(sent).toEqual(expect.arrayContaining([{ code: 'CAP-B', enabled: true }, { code: 'CAP-C', enabled: false }]));
    expect(sent).toHaveLength(2);
    const rows = component.groupedCapabilities()[0].rows;
    expect(rows.every(r => !r.overridden)).toBe(true);
  });

  it('marks only rows that differ from the current install as changed', () => {
    component.ngOnInit();
    const capA = component.groupedCapabilities()[0].rows.find(r => r.code === 'CAP-A')!;

    component.toggle(capA);

    const rows = component.groupedCapabilities()[0].rows;
    expect(rows.filter(r => r.overridden).map(r => r.code)).toEqual(['CAP-A']);
  });
});
