import { describe, it, expect } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';

import { CapabilityService } from '../../shared/services/capability.service';
import { AccountingComponent } from './accounting.component';

type Internals = { visibleTiles(): { route: string }[] };

function tilesWith(enabled: (code: string) => boolean): string[] {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: CapabilityService, useValue: { isEnabled: enabled, capabilities: signal([]) } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
    ],
  });
  TestBed.overrideComponent(AccountingComponent, { set: { template: '', imports: [] } });
  const c = TestBed.createComponent(AccountingComponent).componentInstance as unknown as Internals;
  return c.visibleTiles().map((t) => t.route);
}

describe('AccountingComponent tiles', () => {
  it('shows fixed assets, journal templates and overhead with the full ledger and depreciation on', () => {
    expect(tilesWith(() => true)).toEqual(expect.arrayContaining(['fixed-assets', 'journal-templates', 'overhead']));
  });

  it('hides fixed assets unless depreciation is on too', () => {
    const tiles = tilesWith((code) => code !== 'CAP-ACCT-DEPRECIATION');

    expect(tiles).not.toContain('fixed-assets');
    expect(tiles).toContain('journal-templates');
    expect(tiles).toContain('overhead');
  });

  it('hides all three when the full ledger is off', () => {
    const tiles = tilesWith((code) => code !== 'CAP-ACCT-FULLGL');

    expect(tiles).not.toContain('fixed-assets');
    expect(tiles).not.toContain('journal-templates');
    expect(tiles).not.toContain('overhead');
  });
});
