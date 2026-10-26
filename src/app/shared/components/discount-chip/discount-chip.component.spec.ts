import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';

import { mockSignalInputs } from '../../../../testing/signal-input-harness';
import { DiscountChipComponent } from './discount-chip.component';

function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00Z`;
}

describe('DiscountChipComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideTranslateService()] });
  });

  function open(deadline: string | null, available: number): boolean {
    const chip = TestBed.runInInjectionContext(() => new DiscountChipComponent());
    mockSignalInputs(chip, { percent: 2, deadline, available });
    return (chip as unknown as { open(): boolean }).open();
  }

  it('shows while a discount is left and the deadline has not passed', () => {
    expect(open(isoDaysFromToday(3), 196)).toBe(true);
    expect(open(isoDaysFromToday(0), 196)).toBe(true);
  });

  it('hides once the deadline has passed, nothing is left, or there is no deadline', () => {
    expect(open(isoDaysFromToday(-1), 196)).toBe(false);
    expect(open(isoDaysFromToday(3), 0)).toBe(false);
    expect(open(null, 196)).toBe(false);
  });
});
