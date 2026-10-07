import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Observable, of } from 'rxjs';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';

import { ScanResolveResult } from '../../../../shared/models/mobile-api.model';
import { ScanActionSheetComponent } from './scan-action-sheet.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

const job: ScanResolveResult = { kind: 'job', id: 42, code: 'JOB-42', label: 'JOB-42', subtitle: null };

describe('ScanActionSheetComponent', () => {
  let fixture: ComponentFixture<ScanActionSheetComponent>;

  function render(runningJobId: number | null): HTMLElement {
    fixture = TestBed.createComponent(ScanActionSheetComponent);
    fixture.componentRef.setInput('result', job);
    fixture.componentRef.setInput('runningJobId', runningJobId);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ScanActionSheetComponent],
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } })],
    });
  });

  it('offers Start when no timer runs on this job', () => {
    const el = render(7);
    expect(el.querySelector('[data-testid="scan-action-start"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="scan-action-stop"]')).toBeNull();
  });

  it('swaps Start for Stop while the timer runs on this job', () => {
    const el = render(42);
    const chosen = vi.fn();
    fixture.componentInstance.chosen.subscribe(chosen);

    expect(el.querySelector('[data-testid="scan-action-start"]')).toBeNull();
    el.querySelector<HTMLButtonElement>('[data-testid="scan-action-stop"]')!.click();

    expect(chosen).toHaveBeenCalledWith('stop');
  });
});
