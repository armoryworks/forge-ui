import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { QuotesComponent } from './quotes.component';
import { QuoteService } from './services/quote.service';
import { QuoteListItem } from './models/quote-list-item.model';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { DraftResumeService } from '../../shared/services/draft-resume.service';

interface ListInternals {
  searchControl: FormControl<string | null>;
  statusFilterControl: FormControl<string | null>;
  filteredQuotes(): QuoteListItem[];
}

describe('QuotesComponent filters', () => {
  let list: ListInternals;
  let quoteService: { getQuotes: ReturnType<typeof vi.fn> };

  const quotes = [
    { id: 1, quoteNumber: 'QT-00001', customerName: 'Wasatch Fabrication', status: 'Accepted' },
    { id: 2, quoteNumber: 'QT-00002', customerName: 'Beehive Tooling', status: 'Declined' },
  ] as QuoteListItem[];

  beforeEach(() => {
    vi.useFakeTimers();
    quoteService = { getQuotes: vi.fn(() => of(quotes)) };
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: QuoteService, useValue: quoteService },
        { provide: DetailDialogService, useValue: { getDetailFromUrl: () => null, open: vi.fn() } },
        { provide: DraftResumeService, useValue: { consume: () => false } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
      ],
    });
    list = TestBed.runInInjectionContext(() => new QuotesComponent()) as unknown as ListInternals;
  });

  afterEach(() => vi.useRealTimers());

  it('narrows the list to quotes matching the search text', () => {
    list.searchControl.setValue('qt-00002');
    vi.advanceTimersByTime(250);

    expect(list.filteredQuotes().map(q => q.id)).toEqual([2]);
  });

  it('matches on customer name', () => {
    list.searchControl.setValue('wasatch');
    vi.advanceTimersByTime(250);

    expect(list.filteredQuotes().map(q => q.id)).toEqual([1]);
  });

  it('reloads with the chosen status as soon as the Status filter changes', () => {
    quoteService.getQuotes.mockClear();

    list.statusFilterControl.setValue('Declined');

    expect(quoteService.getQuotes).toHaveBeenCalledWith(undefined, 'Declined');
  });
});
