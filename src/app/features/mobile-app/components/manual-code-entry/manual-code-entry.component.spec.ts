import { TestBed } from '@angular/core/testing';

import { Observable, of } from 'rxjs';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';

import { ManualCodeEntryComponent } from './manual-code-entry.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

describe('ManualCodeEntryComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ManualCodeEntryComponent],
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } })],
    });
  });

  it('is a modal dialog that Escape cancels', () => {
    const fixture = TestBed.createComponent(ManualCodeEntryComponent);
    fixture.detectChanges();
    let dismissed = 0;
    fixture.componentInstance.dismissed.subscribe(() => dismissed++);
    const sheet = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-testid="manual-code-entry"]')!;

    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    sheet.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(dismissed).toBe(1);
  });
});
