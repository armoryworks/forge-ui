import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';

import { mockSignalInputs } from '../../../../testing/signal-input-harness';
import { ToleranceBandComponent } from './tolerance-band.component';

describe('ToleranceBandComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideTranslateService()] });
  });

  function visible(overPercent: number | null, underPercent: number | null): boolean {
    const band = TestBed.runInInjectionContext(() => new ToleranceBandComponent());
    mockSignalInputs(band, { overPercent, underPercent, minComplete: 90, maxAccepted: 110 });
    return (band as unknown as { visible(): boolean }).visible();
  }

  it('shows when either side of the band is set', () => {
    expect(visible(10, 0)).toBe(true);
    expect(visible(0, 5)).toBe(true);
  });

  it('hides for an exact-quantity line', () => {
    expect(visible(0, 0)).toBe(false);
    expect(visible(null, null)).toBe(false);
  });
});
