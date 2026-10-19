import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { EntityPickerComponent } from './entity-picker.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

interface PickerInternals {
  searchControl: { setValue(value: string): void };
  results(): Record<string, unknown>[];
  showMinCharsHint(): boolean;
}

describe('EntityPickerComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  function create() {
    const fixture = TestBed.createComponent(EntityPickerComponent);
    fixture.componentRef.setInput('label', 'Part');
    fixture.componentRef.setInput('entityType', 'parts');
    const picker = fixture.componentInstance;
    picker.ngOnInit();
    return { fixture, picker, internals: picker as unknown as PickerInternals };
  }

  it('hints at the two-character minimum while one character is typed, without searching', () => {
    const { internals } = create();

    internals.searchControl.setValue('J');
    vi.advanceTimersByTime(300);

    expect(internals.showMinCharsHint()).toBe(true);
    httpMock.expectNone(() => true);
  });

  it('searches the server from two characters and reports the result count', () => {
    const { fixture, picker, internals } = create();
    fixture.componentRef.setInput('filters', { isActive: 'true', sort: 'partNumber', order: 'asc' });
    const completed = vi.fn();
    picker.searchCompleted.subscribe(completed);

    internals.searchControl.setValue('SA');
    vi.advanceTimersByTime(300);

    expect(internals.showMinCharsHint()).toBe(false);
    const req = httpMock.expectOne(r => r.url === '/api/v1/parts');
    expect(req.request.params.get('q')).toBe('SA');
    expect(req.request.params.get('isActive')).toBe('true');
    expect(req.request.params.get('sort')).toBe('partNumber');
    req.flush({ items: [{ id: 210, partNumber: 'SA-210' }], totalCount: 1 });

    expect(internals.results()).toEqual([{ id: 210, partNumber: 'SA-210' }]);
    expect(completed).toHaveBeenCalledWith({ term: 'SA', count: 1 });
  });

  it('drops stale results once the text is cut back below two characters', () => {
    const { internals } = create();
    internals.searchControl.setValue('SA');
    vi.advanceTimersByTime(300);
    httpMock.expectOne(r => r.url === '/api/v1/parts').flush({ items: [{ id: 1 }], totalCount: 1 });

    internals.searchControl.setValue('S');

    expect(internals.results()).toEqual([]);
    expect(internals.showMinCharsHint()).toBe(true);
  });

  it('ignores a response that lands after the text was cut back below two characters', () => {
    const { internals } = create();
    internals.searchControl.setValue('SA');
    vi.advanceTimersByTime(300);
    const req = httpMock.expectOne(r => r.url === '/api/v1/parts');

    internals.searchControl.setValue('S');
    req.flush({ items: [{ id: 1 }], totalCount: 1 });

    expect(internals.results()).toEqual([]);
  });

  it('accepts a bare required attribute', () => {
    const { fixture, picker } = create();

    fixture.componentRef.setInput('required', '');

    expect(picker.required()).toBe(true);
  });
});
