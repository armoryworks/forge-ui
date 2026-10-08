import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Observable, of } from 'rxjs';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';

import { OperationQuantitySheetComponent } from './operation-quantity-sheet.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

describe('OperationQuantitySheetComponent', () => {
  let fixture: ComponentFixture<OperationQuantitySheetComponent>;

  function render(completed: number, scrap: number, finishing: boolean): HTMLElement {
    fixture = TestBed.createComponent(OperationQuantitySheetComponent);
    fixture.componentRef.setInput('label', '20 Deburr');
    fixture.componentRef.setInput('jobQuantity', 40);
    fixture.componentRef.setInput('completed', completed);
    fixture.componentRef.setInput('scrap', scrap);
    fixture.componentRef.setInput('finishing', finishing);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const text = (el: HTMLElement, testId: string): string =>
    el.querySelector(`[data-testid="${testId}"]`)?.textContent?.trim() ?? '';
  const click = (el: HTMLElement, testId: string): void => {
    el.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!.click();
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OperationQuantitySheetComponent],
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } })],
    });
  });

  it('from Done, starts at everything not scrapped and shows the scrap already recorded', () => {
    const el = render(12, 1, true);

    expect(text(el, 'operation-qty-good')).toBe('39');
    expect(text(el, 'operation-qty-scrap')).toBe('1');
  });

  it('from +Qty, starts at the recorded count with scrap folded away', () => {
    const el = render(12, 0, false);

    expect(text(el, 'operation-qty-good')).toBe('12');
    expect(el.querySelector('[data-testid="operation-qty-scrap"]')).toBeNull();
    click(el, 'operation-scrap-open');
    expect(text(el, 'operation-qty-scrap')).toBe('0');
  });

  it('steps by one and by ten, never below zero', () => {
    const el = render(5, 0, false);

    click(el, 'operation-qty-plus-10');
    click(el, 'operation-qty-plus');
    expect(text(el, 'operation-qty-good')).toBe('16');

    click(el, 'operation-qty-minus-10');
    click(el, 'operation-qty-minus-10');
    expect(text(el, 'operation-qty-good')).toBe('0');
  });

  it('flags more than the job quantity and refuses to send it', () => {
    const el = render(40, 0, false);
    const recorded = vi.fn();
    fixture.componentInstance.recorded.subscribe(recorded);

    click(el, 'operation-scrap-open');
    click(el, 'operation-scrap-plus');

    expect(el.querySelector('[data-testid="operation-qty-over"]')).not.toBeNull();
    expect(el.querySelector<HTMLButtonElement>('[data-testid="operation-qty-done"]')!.disabled).toBe(true);
    click(el, 'operation-qty-record');
    expect(recorded).not.toHaveBeenCalled();
  });

  it('sends the counts, finished or not', () => {
    const el = render(12, 0, false);
    const recorded = vi.fn();
    fixture.componentInstance.recorded.subscribe(recorded);

    click(el, 'operation-qty-plus');
    click(el, 'operation-qty-record');
    click(el, 'operation-qty-done');

    expect(recorded.mock.calls).toEqual([
      [{ completed: 13, scrap: 0, complete: false }],
      [{ completed: 13, scrap: 0, complete: true }],
    ]);
  });
});
