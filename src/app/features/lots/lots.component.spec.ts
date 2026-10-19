import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { LotService } from './services/lot.service';
import { LotListItem } from './models/lot-list-item.model';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { DraftResumeService } from '../../shared/services/draft-resume.service';
import { LotsComponent } from './lots.component';

interface LotsInternals {
  searchControl: FormControl<string | null>;
  applySearch(): void;
  isExpired(lot: LotListItem): boolean;
}

function setup() {
  const getLots = vi.fn(() => of([]));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: LotService, useValue: { getLots } },
      { provide: SnackbarService, useValue: { success: vi.fn() } },
      { provide: TranslateService, useValue: { instant: (key: string) => key } },
      { provide: DetailDialogService, useValue: { getDetailFromUrl: () => null, open: vi.fn() } },
      { provide: DraftResumeService, useValue: { consume: () => false } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new LotsComponent());
  return { lots: component as unknown as LotsInternals, getLots };
}

const lot = (expirationDate: string | null) => ({ expirationDate } as unknown as LotListItem);

function dayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00Z`;
}

describe('LotsComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('searches with the trimmed term', () => {
    const { lots, getLots } = setup();

    lots.searchControl.setValue('  r-26 ');
    lots.applySearch();

    expect(getLots).toHaveBeenLastCalledWith('r-26');
  });

  it('marks a lot expired only once its date has passed', () => {
    const { lots } = setup();

    expect(lots.isExpired(lot(dayOffset(-1)))).toBe(true);
    expect(lots.isExpired(lot(dayOffset(0)))).toBe(false);
    expect(lots.isExpired(lot(dayOffset(30)))).toBe(false);
    expect(lots.isExpired(lot(null))).toBe(false);
  });
});
