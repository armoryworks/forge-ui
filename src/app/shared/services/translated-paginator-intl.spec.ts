import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { TranslatedPaginatorIntl } from './translated-paginator-intl';

const EN = {
  paginator: {
    itemsPerPage: 'Items per page:', nextPage: 'Next page', previousPage: 'Previous page',
    firstPage: 'First page', lastPage: 'Last page',
    range: '{{start}} – {{end}} of {{length}}', rangeEmpty: '0 of {{length}}',
  },
};
const ES = {
  paginator: {
    itemsPerPage: 'Elementos por página:', nextPage: 'Página siguiente', previousPage: 'Página anterior',
    firstPage: 'Primera página', lastPage: 'Última página',
    range: '{{start}} – {{end}} de {{length}}', rangeEmpty: '0 de {{length}}',
  },
};

describe('TranslatedPaginatorIntl', () => {
  let translate: TranslateService;
  let intl: TranslatedPaginatorIntl;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideTranslateService(), TranslatedPaginatorIntl],
    });
    translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', EN);
    translate.setTranslation('es', ES);
    translate.use('en');
    intl = TestBed.inject(TranslatedPaginatorIntl);
  });

  it('labels the paginator in the current language', () => {
    expect(intl.itemsPerPageLabel).toBe('Items per page:');
    expect(intl.getRangeLabel(1, 25, 60)).toBe('26 – 50 of 60');
    expect(intl.getRangeLabel(0, 25, 0)).toBe('0 of 0');
  });

  it('relabels and notifies the paginator when the language switches', () => {
    let notified = 0;
    intl.changes.subscribe(() => notified++);

    translate.use('es');

    expect(intl.itemsPerPageLabel).toBe('Elementos por página:');
    expect(intl.nextPageLabel).toBe('Página siguiente');
    expect(intl.getRangeLabel(2, 25, 60)).toBe('51 – 60 de 60');
    expect(notified).toBeGreaterThan(0);
  });
});
