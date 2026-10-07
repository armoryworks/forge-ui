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

  function render(runningJobId: number | null, actingAs: string | null = null): HTMLElement {
    fixture = TestBed.createComponent(ScanActionSheetComponent);
    fixture.componentRef.setInput('result', job);
    fixture.componentRef.setInput('runningJobId', runningJobId);
    fixture.componentRef.setInput('actingAs', actingAs);
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

  it('shows who is acting and lets someone else say it is not them', () => {
    const el = render(null, 'Ana Ruiz');
    const notYou = vi.fn();
    fixture.componentInstance.notYou.subscribe(notYou);

    expect(el.querySelector('[data-testid="scan-acting-as"]')).not.toBeNull();
    el.querySelector<HTMLButtonElement>('[data-testid="scan-not-you"]')!.click();

    expect(notYou).toHaveBeenCalledOnce();
  });

  it('hides the acting-as line when nobody is identified', () => {
    expect(render(null).querySelector('[data-testid="scan-acting-as"]')).toBeNull();
  });
});
